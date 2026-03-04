# Firebase Setup Instructions

⚠️ **IMPORTANT SECURITY NOTICE** ⚠️

This project uses Firebase for authentication and cloud storage. To protect your Firebase project, **never commit your `firebase-config.js` file to version control**.

## Quick Setup (5 minutes)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name (e.g., "My Word Analyzer")
4. Follow the setup wizard
5. Once created, click the **Web icon** (`</>`) to add a web app
6. Register your app with a nickname
7. Copy the Firebase configuration object

### Step 2: Configure Your App

1. In your project folder, find `firebase-config.template.js`
2. **Copy** this file and rename it to `firebase-config.js`
3. Open `firebase-config.js` in a text editor
4. Replace the placeholder values with your actual Firebase credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",           // Replace this
    authDomain: "your-project.firebaseapp.com",  // Replace this
    projectId: "your-project-id",            // Replace this
    storageBucket: "your-project.firebasestorage.app",  // Replace this
    messagingSenderId: "123456789",          // Replace this
    appId: "1:123456789:web:abc123",        // Replace this
    measurementId: "G-XXXXXXXXXX"            // Replace this
};
```

5. Save the file

### Step 3: Enable Google Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click **Google**
3. Toggle **Enable**
4. Enter a support email
5. Click **Save**

### Step 4: Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Select **"Start in production mode"**
4. Choose a location close to you
5. Click **Enable**

### Step 5: Set Up Security Rules

1. In Firestore Database, click the **Rules** tab
2. Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **Publish**

### Step 6: Test Your Setup

1. Start a local web server:
   ```bash
   python -m http.server 8000
   ```

2. Open http://localhost:8000 in your browser

3. You should see the Google Sign-In screen

4. Sign in with your Google account

5. If successful, you'll see the Word Analyzer app!

## Security Best Practices

✅ **DO:**
- Keep `firebase-config.js` in your `.gitignore` file
- Set up Firestore security rules
- Use Firebase App Check for additional protection
- Monitor usage in Firebase Console

❌ **DON'T:**
- Commit `firebase-config.js` to version control
- Share your Firebase configuration publicly
- Give your API keys to others
- Skip setting up security rules

## Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
- Add your domain to authorized domains in Firebase Console
- Go to Authentication → Settings → Authorized domains
- Add `localhost` for local development

### "Missing or insufficient permissions"
- Check your Firestore security rules
- Make sure you're signed in
- Verify the rules allow access for your user ID

### "API key not valid"
- Double-check you copied all values correctly
- Make sure there are no extra spaces or quotes
- Verify the API key hasn't been restricted

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com/)
- [GitHub Issues](https://github.com/LBranigan/word-analyzer/issues)

## Deployment to Production

When deploying to GitHub Pages or another hosting service:

1. Your `firebase-config.js` will need to be manually added to your hosting environment
2. Add your production domain to Firebase authorized domains
3. Update CORS settings if needed
4. Consider using environment variables for better security

---

**Remember:** Never commit your actual `firebase-config.js` file to GitHub!
