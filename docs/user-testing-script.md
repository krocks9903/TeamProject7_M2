# FinePrint Agent — User Testing Script (read aloud)

**Team DNK · CEN 4930 · M3 plan / M4 sessions**  
**Use with:** external testers only (not teammates, not the instructor).  
**Time:** ~20–25 minutes per person.  
**Setup before they arrive:** `npm run dev` running at http://localhost:3000 (or your Vercel URL). Have 1–2 sample PDFs ready (lease, gym, or contractor). Offer *their* PDF if they want — warn it stays on the demo machine.

---

## 0. Facilitator checklist (silent — do not read)

- [ ] Recorder consent (Zoom or phone) — optional; note if declined  
- [ ] Demo URL / laptop ready; sample PDFs on Desktop  
- [ ] One teammate facilitates; one takes notes (stuck moments, quotes)  
- [ ] Session ID: `UT-____` · Date: ________ · Facilitator: ________  

---

## 1. Opening (2 min)

Hi, thanks for helping us out. This is for a class project at FGCU — we’re building a tool called **FinePrint Agent**.

We’re going to ask you to try a short prototype. There are **no right or wrong answers**. If something is confusing, that’s useful for us — please say it out loud.

We’re **not** lawyers and this tool is **not** legal advice. It only highlights text that appears in the document you upload.

This should take about **twenty minutes**. You can stop anytime. Okay to continue?

*(Wait for yes. Note consent for recording if using one.)*

---

## 2. Warm-up (3 min)

Before we open the tool, a few quick questions:

1. Think of the last important document you signed or almost signed — lease, gym, phone, insurance, internship, anything like that. **What was it?**
2. How did you usually check it — skim, Ctrl+F, ask someone, paste into ChatGPT, hire anyone, or just sign?
3. Have you ever been surprised later by a fee, deposit, renewal, or deadline? **What happened**, roughly?

*(Note their “current hire” and any money/time cost in their words.)*

---

## 3. Task brief (1 min)

Here’s the task:

> Imagine you’re about to sign this document tonight. Use FinePrint to find out **what will cost you money** and **what might trap you later** — fees, renewals, deposits, penalties.  
> Say what you’re thinking as you go. We’ll stay quiet unless you’re stuck.

I’ll give you a sample PDF unless you prefer one of your own. Ready?

*(Hand them the laptop / share the URL. Prefer sample PDF first for consistency.)*

---

## 4. During the task (8–10 min) — prompts only if stuck

**Stay silent** unless they stop for ~20 seconds or ask for help. Then use **one** of these:

- “What are you looking for right now?”
- “What does that finding mean to you?”
- “Would you trust that quote? Why or why not?”
- “What’s missing that you expected to see?”
- “If you had to decide in the next hour — sign, negotiate, or walk away — what would you do based on this screen?”

**Do not** explain how the agent works, defend the UI, or suggest where to click unless they ask “what do I do?”

**Note silently:** first click, confusion, surprise, mistrust of a finding, anything they read aloud.

---

## 5. After the scan (5 min)

Thanks — you can stop using the tool. A few follow-ups:

1. In your own words, **what did FinePrint do?**
2. Was anything **surprising** — a fee you didn’t know about, or a warning that felt wrong?
3. Did the **quotes from the document** make you trust it more or less? Why?
4. What’s the **one thing** that would make you use this again before signing?
5. What would make you **never** use it again?
6. On a scale of 1–5, how likely are you to use something like this before your next lease or contract?  
   **1** = never · **5** = definitely. Why that number?

---

## 6. Closing (1 min)

That’s everything. Thank you — this helps us decide what to fix next.

We won’t share your name in our class report. If we use a quote, we’ll keep it anonymous.

Any questions for us before we wrap?

*(Stop recording. Fill the session template below while it’s fresh.)*

---

## Session notes template (fill after — not read aloud)

| Field | Notes |
|---|---|
| Session ID | UT- |
| Date / format | in person / Zoom |
| Tester (role only, no full name) | e.g. “junior renter”, “grad student” |
| Document used | sample lease / gym / their own |
| How they check docs today | |
| Surprise moment | |
| Stuck moment | |
| Trust of citations (high/med/low + why) | |
| Likelihood 1–5 + reason | |
| Best quote (anonymous) | |
| One change they implied we should make | |

**Facilitator judgment (circle one):** Proceed as-is · Pivot UX · Scope down · Needs clearer “not legal advice”

---

## Optional second task (only if time — 5 min)

> Without uploading again: if this tool emailed you when a landlord or company sent a renewal or fee notice, would you want that? What would make that helpful vs annoying?

*(For M3 email-filter idea — optional; skip if tired.)*

---

## Facilitator don’ts

- Don’t apologize for bugs mid-task — note them, keep going.  
- Don’t say “the AI should have caught X” — ask what *they* expected.  
- Don’t let teammates interrupt the tester.  
- Don’t collect SSNs, account numbers, or full legal names in notes.
