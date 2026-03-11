require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const cron = require('node-cron');
const axios = require('axios');
const { Resend } = require('resend');
const path = require('path');

const app = express();
const prisma = new PrismaClient();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- API ENDPOINTS ---

app.post('/api/monitors', async (req, res) => {
    const { name, url, interval, email, alertThreshold, criticalThreshold } = req.body;
    if (!url || !interval || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const monitor = await prisma.monitor.create({
            data: {
                name: name || 'Monitor',
                url,
                interval: parseInt(interval),
                email,
                alertThreshold: alertThreshold ? parseInt(alertThreshold) : 1000,
                criticalThreshold: criticalThreshold ? parseInt(criticalThreshold) : 2000
            }
        });
        res.json(monitor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/monitors', async (req, res) => {
    try {
        const monitors = await prisma.monitor.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(monitors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/monitors/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.monitor.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/monitors/:id', async (req, res) => {
    const { id } = req.params;
    const { name, url, interval, email, alertThreshold, criticalThreshold } = req.body;

    try {
        const monitor = await prisma.monitor.update({
            where: { id },
            data: {
                name: name || 'Monitor',
                url,
                interval: parseInt(interval),
                email,
                alertThreshold: parseInt(alertThreshold),
                criticalThreshold: parseInt(criticalThreshold)
            }
        });
        res.json(monitor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/monitors/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const { timeframe } = req.query; // '5m', '10m', '30m', '1h', '6h', '12h', '1d'

        const now = new Date();
        let thresholdDate = new Date(now.getTime() - 60 * 60 * 1000); // Default 1h

        switch (timeframe) {
            case '5m': thresholdDate = new Date(now.getTime() - 5 * 60 * 1000); break;
            case '10m': thresholdDate = new Date(now.getTime() - 10 * 60 * 1000); break;
            case '30m': thresholdDate = new Date(now.getTime() - 30 * 60 * 1000); break;
            case '1h': thresholdDate = new Date(now.getTime() - 60 * 60 * 1000); break;
            case '6h': thresholdDate = new Date(now.getTime() - 6 * 60 * 60 * 1000); break;
            case '12h': thresholdDate = new Date(now.getTime() - 12 * 60 * 60 * 1000); break;
            case '1d': thresholdDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
        }

        const history = await prisma.monitorHistory.findMany({
            where: {
                monitorId: id,
                createdAt: { gte: thresholdDate }
            },
            orderBy: { createdAt: 'desc' },
            take: 1500
        });
        res.json(history.reverse()); // return chronological order
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CRON JOB ---

// Run every minute
cron.schedule('* * * * *', async () => {
    console.log('Running monitor checks...');

    try {
        // We check all monitors. In a real highly scalable app we'd query carefully and queue.
        const monitors = await prisma.monitor.findMany();
        const now = new Date();

        for (const monitor of monitors) {
            // Check if it's time to test this monitor
            const timeSinceLastCheckMs = now - new Date(monitor.lastCheckedAt);
            const intervalMs = monitor.interval * 60 * 1000;

            // We allow a small 5 seconds buffer
            if (timeSinceLastCheckMs >= intervalMs - 5000 || monitor.status === 'pending') {
                let isUp = false;
                let responseTime = 0;
                const startTime = Date.now();

                try {
                    const response = await axios.get(monitor.url, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        validateStatus: function (status) {
                            return status >= 200 && status < 500; // Resolve for < 500
                        }
                    });
                    // Cloudflare and strict WAFs return 401/403 for automated bots. 
                    // To us, this means the server is UP.
                    isUp = (response.status >= 200 && response.status < 400) || response.status === 401 || response.status === 403;
                    responseTime = Date.now() - startTime;

                    if (responseTime > (monitor.criticalThreshold || 2000)) {
                        isUp = false; // Consider slow as down for alerting purposes in this simple SaaS
                    }
                } catch (error) {
                    isUp = false;
                }

                const newStatus = isUp ? 'up' : 'down';

                // Log History
                await prisma.monitorHistory.create({
                    data: {
                        monitorId: monitor.id,
                        responseTime: responseTime,
                        status: newStatus
                    }
                });

                // If status changed to down, or we just detected down, send email
                if (newStatus === 'down' && monitor.status !== 'down') {
                    if (process.env.RESEND_API_KEY) {
                        try {
                            const formatter = new Intl.DateTimeFormat('pt-BR', {
                                timeZone: 'America/Sao_Paulo',
                                dateStyle: 'short',
                                timeStyle: 'medium',
                            });
                            const dateGmt3 = formatter.format(now);

                            const htmlTemplate = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #f9fafb;">
                                <div style="text-align: center; margin-bottom: 20px;">
                                    <h1 style="color: #dc2626; margin: 0; font-size: 24px;">🚨 Alerta de Monitoramento!</h1>
                                </div>
                                <div style="background-color: white; padding: 20px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                    <p style="color: #374151; font-size: 16px; margin-top: 0;">Foi detectado um problema ou lentidão no seu serviço.</p>
                                    
                                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                                        <tr>
                                            <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280; width: 120px;"><strong>URL:</strong></td>
                                            <td style="padding: 10px; border-bottom: 1px solid #f3f4f6;"><a href="${monitor.url}" style="color: #2563eb; text-decoration: none;">${monitor.url}</a></td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #6b7280;"><strong>Tempo:</strong></td>
                                            <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: ${responseTime > (monitor.criticalThreshold || 2000) ? '#dc2626' : (responseTime > (monitor.alertThreshold || 1000) ? '#d97706' : '#059669')}; font-weight: bold;">${responseTime} milissegundos</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px; color: #6b7280;"><strong>Data / Hora:</strong></td>
                                            <td style="padding: 10px; color: #374151;">${dateGmt3} (GMT-3)</td>
                                        </tr>
                                    </table>
                                </div>
                                <div style="margin-top: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                                    <p>Enviado automaticamente pelo seu Uptime Monitor SaaS.</p>
                                </div>
                            </div>
                            `;

                            const emailsToSend = monitor.email ? monitor.email.split(',').map(e => e.trim()).filter(e => e) : [];

                            if (emailsToSend.length > 0) {
                                await resend.emails.send({
                                    from: 'onboarding@resend.dev', // Default testing domain for resend
                                    to: emailsToSend,
                                    subject: `Alerta: ${monitor.url} está OFFLINE ou LENTO!`,
                                    html: htmlTemplate
                                });
                                console.log(`Alert email sent to ${emailsToSend.join(', ')} for ${monitor.url} at ${dateGmt3}`);
                            }
                        } catch (err) {
                            console.error('Failed to send email:', err);
                        }
                    } else {
                        console.log(`[Email skipped] No RESEND_API_KEY. ${monitor.url} is DOWN.`);
                    }
                }

                // Update DB
                await prisma.monitor.update({
                    where: { id: monitor.id },
                    data: {
                        status: newStatus,
                        lastCheckedAt: new Date()
                    }
                });
            }
        }
    } catch (err) {
        console.error('Error in cron job', err);
    }
});

// --- SERVE STATIC FRONTEND ---
// Needed for Railway deployment
app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.get('/{*any}', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
