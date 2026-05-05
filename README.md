Deployment guide for Railway (Flat structure)

- Step 1: Rotate your bot token and store securely
  - Go to your bot in the Developer Portal, regenerate the token, and copy it.
  - Do not paste the token anywhere public. Save it as an environment variable in Railway.
- Step 2: Initialize repo (if not already)
  - git init
  - git add .
  - git commit -m "feat: scaffold bot ready for Railway deployment"
- Step 3: Push to GitHub
  - Create a new repo on GitHub and push this code.
- Step 4: Deploy on Railway
  - Create a new Railway project, connect to the GitHub repo.
  - In the project settings, add an environment variable named BOT_TOKEN with the token you regenerated.
  - Ensure the plan is production/paid to keep the app running 24/7 (free plans may sleep).
- Step 5: Run and monitor
  - Ensure the bot starts in Railway logs: npm start
  - Invite the bot to your server and verify it responds.

Notes:
- The sample skeleton uses Node.js and discord.js v14. Adjust as needed for your framework.
