# Zayko - Order Smart, Eat Fresh

Zayko is a campus canteen ordering application with secure Google sign-in and PIN-based authentication.

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### 1. Prerequisites
- **Node.js**: (Version 18.x or 20.x recommended)
- **Firebase**: A Firebase project with Authentication (Google Provider) and Firestore enabled.

### 2. Installation
Clone the repository and install dependencies:
```bash
# Clone the repository
git clone https://github.com/ashu7869819242-cloud/Zayko.git
cd Zayko/newcafe

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the `newcafe` directory and add your Firebase configurations:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Required for secure registration/PIN verification)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"
```

### 4. Running the Project
To start the development server locally:
```bash
cd newcafe
npm run dev
```

To run in **Host Mode** (accessible from mobile/other devices on the same Wi-Fi):
```bash
cd newcafe
npm run dev -- -H 0.0.0.0
```
Open [http://localhost:3000](http://localhost:3000) on your PC, or use your PC's IP address (e.g., `http://192.168.1.5:3000`) on your mobile.

## 🔒 Authentication Flow
1. **Google Sign-In**: Authenticate using your Google account.
2. **Registration**: First-time users must provide:
   - Full Name
   - 10-digit Mobile Number
   - 4-digit PIN (hashed with BCrypt)
3. **PIN Lock**: Every new session requires the 4-digit PIN to unlock the application.

## 🛠️ Features
- **Smart Menu**: Browse and order food items.
- **Jarvis Assistant**: Voice/Text AI assistant for ordering.
- **Wallet System**: Pre-paid wallet for quick transactions.
- **Admin Dashboard**: Manage inventory, orders, and view customer feedback.
