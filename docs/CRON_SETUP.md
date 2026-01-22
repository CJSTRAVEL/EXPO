# CJ's Executive Travel - System Maintenance Setup Guide

## Overview
The system maintenance endpoint handles two critical automated tasks:
1. **Document Expiry Reminders**: Sends email alerts to admin@cjstravel.uk when driver/vehicle documents are expiring in 60 or 30 days
2. **Data Cleanup**: Removes processed booking requests (approved/rejected) older than 30 days

## API Endpoint
```
POST /api/admin/system-maintenance
```

## Setting Up Scheduled Maintenance

### Option 1: Linux Cron Job (Recommended for VPS/Dedicated Server)

1. Open crontab editor:
```bash
crontab -e
```

2. Add the following line to run daily at 9:00 AM:
```bash
0 9 * * * curl -X POST https://your-domain.com/api/admin/system-maintenance >> /var/log/cj-maintenance.log 2>&1
```

Replace `your-domain.com` with your actual domain (e.g., `cjbooking.preview.emergentagent.com`).

### Option 2: Windows Task Scheduler

1. Create a PowerShell script `maintenance.ps1`:
```powershell
Invoke-RestMethod -Uri "https://your-domain.com/api/admin/system-maintenance" -Method POST
```

2. Open Task Scheduler → Create Basic Task
3. Set trigger: Daily at 9:00 AM
4. Set action: Start a program → `powershell.exe`
5. Arguments: `-ExecutionPolicy Bypass -File "C:\path\to\maintenance.ps1"`

### Option 3: Cloud Scheduler (AWS, GCP, Azure)

#### AWS CloudWatch Events
```json
{
  "schedule": "cron(0 9 * * ? *)",
  "targets": [{
    "id": "cj-maintenance",
    "arn": "arn:aws:lambda:region:account:function:curl-runner",
    "input": "{\"url\": \"https://your-domain.com/api/admin/system-maintenance\", \"method\": \"POST\"}"
  }]
}
```

#### GCP Cloud Scheduler
```bash
gcloud scheduler jobs create http cj-maintenance \
  --schedule="0 9 * * *" \
  --uri="https://your-domain.com/api/admin/system-maintenance" \
  --http-method=POST \
  --time-zone="Europe/London"
```

### Option 4: Using a Free Service (UptimeRobot, cron-job.org)

1. Go to https://cron-job.org (free tier available)
2. Create account and add new cron job
3. URL: `https://your-domain.com/api/admin/system-maintenance`
4. Method: POST
5. Schedule: Daily at 9:00 AM

## Testing the Endpoint

Run manually to verify it's working:
```bash
curl -X POST https://your-domain.com/api/admin/system-maintenance
```

Expected response:
```json
{
  "message": "System maintenance completed",
  "expiry_emails_sent": 2,
  "old_requests_deleted": 5
}
```

## Email Configuration

The maintenance system uses Mailgun to send emails. Ensure these environment variables are set in `/app/backend/.env`:
```
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain
```

## Document Expiry Timeline
- **60 days before expiry**: First warning email sent
- **30 days before expiry**: Urgent reminder email sent

Documents checked:
- Driver: License expiry, DBS expiry
- Vehicle: MOT expiry, Insurance expiry, Tax expiry

## Troubleshooting

### No emails being sent
1. Check Mailgun API key is valid
2. Verify admin@cjstravel.uk is in allowed recipients (if sandbox mode)
3. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`

### Cron job not running
1. Check cron service: `systemctl status cron`
2. View cron logs: `grep CRON /var/log/syslog`
3. Ensure curl is installed: `which curl`

## Support
For issues, contact the development team.
