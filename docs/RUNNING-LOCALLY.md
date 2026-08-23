# Running Finquanta on your own computer

A plain-English guide. No prior knowledge assumed. Follow it top to bottom.

---

## What you are actually starting

Finquanta is **two programs** that both have to be running at the same time.
They talk to each other.

| | What it is | Where it lives | Address |
|---|---|---|---|
| **The website** | The pages you look at and click | the `user` folder | `localhost:3000` |
| **The server** | The engine: saves data, talks to Stripe | the `server` folder | `localhost:3001` |

**"localhost" just means "this computer."** The number after the colon is like a
door number. Two programs cannot use the same door, which is why one uses 3000
and the other 3001.

> **The single most useful thing to remember:** you visit the website on
> **3000**. Everything else — Stripe, the API — talks to **3001**. If you ever
> see instructions mentioning 3001 and think "but my site is 3000", both are
> correct. They are different programs.

---

## Opening a terminal

A terminal is a window where you type commands instead of clicking.

1. Press the **Windows key**
2. Type `powershell`
3. Press **Enter**

A dark window opens. That is a terminal. You will need **three** of them open at
once. Each one runs one thing and then stays busy, which is normal — a terminal
running a program will not accept new commands until you stop it.

To open another, just repeat the steps above. You can have as many as you like.

---

## Step 1 — Start the server (terminal 1)

Type this and press Enter:

```
cd "C:\Users\Gior Dario\Finquanta_Main\server"
```

Then:

```
npm run dev
```

**What you should see:** a lot of text scrolling, then it settles down. Look for
a line with a rocket:

```
🚀 Server listening on http://0.0.0.0:3001
```

**This takes a while — up to two minutes.** That is normal and not a crash. On
startup the server checks and updates the database structure, and this computer
has a slow hard drive. Wait for the rocket line before moving on.

**Leave this window open.** Closing it stops the server.

---

## Step 2 — Start the website (terminal 2)

Open a **second** terminal. Type:

```
cd "C:\Users\Gior Dario\Finquanta_Main\user"
```

Then:

```
npm run dev
```

**What you should see:**

```
▲ Next.js 16.2.7 (Turbopack)
- Local:  http://localhost:3000
✓ Ready in 2.1s
```

**Leave this window open too.**

Now open your browser and go to **http://localhost:3000**. The site should load.

> **First visit to any page is slow.** The website builds each page the first
> time you open it. Ten to sixty seconds on a page you have not visited since
> starting is expected. It is fast every time after that.

---

## Step 3 — Connect Stripe so payments work (terminal 3)

**Skip this step unless you are testing buying a plan.** The site works fine
without it — you just cannot complete a purchase.

### Why this step exists

When someone pays, Stripe has to tell your server "that payment went through" so
the server can switch the customer onto their new plan. Stripe does this by
sending a message to your server.

**Stripe cannot reach your computer.** Your computer is not on the public
internet — it is behind your home router, with no public address. So Stripe's
message goes nowhere, the server never hears that the payment succeeded, and the
customer's plan never changes.

This is exactly what happened when you tested before. The payment worked
perfectly. The message telling the server about it never arrived.

The fix is a small program from Stripe that **opens a tunnel**: it connects out
to Stripe from your machine, catches the messages, and hands them to your server
locally. It has to be running *at the moment you pay*.

### The command

Open a **third** terminal and type:

```
stripe listen --forward-to localhost:3001/api/v1/billing/webhook
```

**Read that address carefully. Three things must be exactly right:**

- **`3001`**, not 3000 — this goes to the server, not the website
- **`/api`** — it is easy to leave out and nothing works without it
- the rest of the path, exactly as written

**The first time only**, it will ask you to log in. Press Enter, your browser
opens, click the button to allow it, come back to the terminal.

**What you should see:**

```
> Ready! You are using Stripe API Version [2024-04-10].
  Your webhook signing secret is whsec_87f25... (^C to quit)
```

That is it. **Leave this window open while you test.**

> **Good news:** the `whsec_...` secret it shows is already saved in your
> settings file. You do not need to copy it anywhere. If you ever see the
> secret change, tell Claude and it will update the file.

---

## Step 4 — Test buying the Starter plan

With **all three** terminals running:

1. Go to **http://localhost:3000**
2. Sign in
3. Go to pricing and choose **Starter**
4. Pay using the test card below

### The test card

This is a fake card provided by Stripe. **No real money moves.**

| Field | What to enter |
|---|---|
| Card number | `4242 4242 4242 4242` |
| Expiry | any future date, e.g. `12/34` |
| CVC | any 3 digits, e.g. `123` |
| Postcode | any valid one, e.g. `12345` |

### What should happen

Watch **terminal 3** (Stripe). Within a few seconds you should see lines
appear, including one saying `invoice.paid`.

In the browser you will briefly see "Confirming your payment…", then:

> **You're now on our Starter Plan**

That means it worked end to end.

### If it says "Payment received — still settling"

That message means the server did not confirm the plan in time. Check, in order:

1. **Is terminal 3 running?** If it is not, the message never reached the
   server. This is the most common cause by far.
2. **Does the address have `/api` in it?** Without it, Stripe's message hits a
   dead end.
3. **Is it pointing at 3001?** 3000 is the website and cannot handle it.
4. **Look at terminal 1 (the server).** If a payment arrived but could not be
   matched to a plan, it now prints a loud line starting
   `PAID INVOICE NOT GRANTED`. That line names the price ID that was charged and
   which settings are missing — send it to Claude and it will be obvious.

---

## Stopping everything

Click on a terminal window and press **Ctrl + C**. That stops whatever is
running in it. Do this in each of the three, then close the windows.

---

## When things go wrong

### One page hangs forever, but other pages load fine

The website's build cache has corrupted itself. This is a known bug in the build
tool, not in your code. Fix:

1. Press **Ctrl + C** in terminal 2 to stop the website
2. **Close any terminal that is sitting inside the project folder** — on
   Windows an open window can hold a folder open and block the next step
3. Run these two commands:

```
cd "C:\Users\Gior Dario\Finquanta_Main\user"
Remove-Item -Recurse -Force .next
```

4. Start it again with `npm run dev`

The next start will be slower than usual. That is expected — it is rebuilding.

### I changed something but the site still shows the old version

- **Server changes** (the `server` folder) apply on their own. It watches for
  changes and reloads. No action needed.
- **Website changes** usually apply on their own too, but **wording and
  translation files are stubbornly cached**. If you see a raw label like
  `pricing.pfWorkspaces` instead of the actual word, that is the cache. Stop
  terminal 2 with Ctrl + C and start it again.

### "The term 'stripe' is not recognized"

The Stripe program is installed, but the terminal you have open was started
*before* it was installed and does not know about it yet.

**Close that terminal, open a fresh one, and try again.**

### Something is already using port 3000 / 3001

An old copy is still running from last time. To find and stop it:

```
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
```

That prints a number. Then, using that number:

```
taskkill /PID <the-number> /T /F
```

Replace `<the-number>` with what was printed. Same works for 3001.

---

## Before this goes live to real customers

One thing must be checked in the Stripe website, and it is easy to miss.

Stripe keeps **two completely separate lists** of where to send payment
messages: one for **test mode** and one for **live mode**. Setting it up in test
mode does *not* set it up for real customers.

In the Stripe dashboard, go to **Developers → Webhooks**, and check **both**
lists (there is a test/live toggle). The address must be:

```
https://finquanta-main-2.onrender.com/api/v1/billing/webhook
```

**If `/api` is missing, real customers will pay and never receive their plan** —
with no error shown to them. This is worth checking carefully.
