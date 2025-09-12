import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { Resend } from 'resend';

const app = express();
app.use(cors());
app.use(express.json());

const {
  RESEND_API_KEY,        // Your Resend key
  EMAIL_FROM = 'StellarRec <no-reply@yourdomain.com>',
  FRONTEND_BASE = 'https://stellarrec.netlify.app/dashboard',
  SIGNING_SECRET = 'change_me' // set a strong secret in env
} = process.env;

const resend = new Resend(RESEND_API_KEY);

/* helper: sign payload */
function sign(data) {
  const h = crypto.createHmac('sha256', SIGNING_SECRET);
  h.update(JSON.stringify(data));
  return h.digest('hex');
}

app.post('/api/recommendations', async (req, res) => {
  try {
    const {
      student_name, student_email, student_first, student_last,
      recommender_name, recommender_email,
      unitids = [], waive = 1, title = ''
    } = req.body || {};

    if (!student_name || !student_email || !recommender_name || !recommender_email) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // create a server id and signature
    const id = 'sr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const sig = sign({ id, student_email, recommender_email, unitids });

    // build the recommender link (your importer already understands these params)
    const params = new URLSearchParams({
      sf: student_first || '',
      sl: student_last || '',
      se: student_email || '',
      waive: String(waive || 0),
      unis: unitids.join(','),
      rname: recommender_name,
      remail: recommender_email,
      rid: id,
      sig,
    });

    if (title) params.set('title', title);

    const recommenderURL = `${FRONTEND_BASE}#recommender?${params.toString()}`;

    // send email
    const html = `<p>Hi ${recommender_name},</p>
<p>${student_name} has requested a recommendation via <b>StellarRec</b>.</p>
<p>Click the link below to open the Recommender portal with the student's details and selected universities preloaded:</p>
<p><a href="${recommenderURL}">${recommenderURL}</a></p>
<p>If the link doesn't open automatically, copy and paste it into your browser.</p>
<hr/>
<p>Thanks,<br/>StellarRec</p>`;

    if (!RESEND_API_KEY) {
      // Dev fallback: log instead of email
      console.log('[DEV EMAIL]', { to: recommender_email, html });
    } else {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: recommender_email,
        subject: `Recommendation request for ${student_name}`,
        html
      });
    }

    // (Optional) Store record in your DB here

    res.json({ id, status: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Email failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Backend listening on', PORT));