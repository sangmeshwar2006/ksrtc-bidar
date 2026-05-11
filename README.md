# Yatra Karnataka 🚍
### Smart Real-Time Bus Tracking & Transit Management Platform for Karnataka

Yatra Karnataka is a modern AI-powered public transportation platform designed for KSRTC/KKRTC buses with real-time bus tracking, ETA prediction, smart route search, city bus integration, and digital ticket booking.

The platform aims to modernize Karnataka’s public transportation ecosystem by providing passengers with accurate live bus information, intelligent route discovery, and seamless mobility services.

---

# ✨ Features

## 🚍 Real-Time Bus Tracking
- Live GPS-based bus tracking
- Moving bus markers on map
- Route visualization
- Realtime location updates
- Delay detection

## ⏱ Smart ETA Prediction
- AI-powered arrival estimation
- Traffic-aware calculations
- Dynamic travel duration prediction
- Distance remaining estimation

## 🔍 Smart Route Search
- Source & destination search
- Intelligent route matching
- Auto-complete suggestions
- Route filtering
- Search history

## 🏙 Bidar City Bus Module
- Local city bus tracking
- Nearby bus stops
- Live city bus ETA
- Local route search
- Realtime occupancy updates

## 🎫 Digital Ticket Booking
- Online ticket reservation
- Seat layout selection
- QR-based tickets
- Payment gateway integration
- Booking history

## 🗺 Advanced Live Maps
- Google Maps integration
- Route polyline visualization
- Nearby buses
- Traffic overlay
- Bus stop markers

## 🔔 Smart Notifications
- Bus arrival alerts
- Delay notifications
- Boarding reminders
- Emergency alerts

## 🌐 Multilingual Support
- English
- Kannada

## 🤖 AI Features
- Smart ETA prediction
- Traffic-aware delays
- Peak-hour analysis
- Smart route recommendations

---

# 🛠 Tech Stack

## Frontend
- React Native
- Expo
- TypeScript
- Tailwind CSS
- Framer Motion
- Zustand
- React Query

## Backend
- Node.js
- Express.js
- Firebase

## Database
- Firebase Firestore
- Firebase Realtime Database

## Maps & Navigation
- Google Maps API
- Google Directions API

## AI & Analytics
- Python
- FastAPI
- Scikit-learn

## Authentication
- Firebase Authentication
- Google Login
- Phone OTP

## Notifications
- Firebase Cloud Messaging (FCM)

## Deployment
- Vercel
- Firebase Hosting
- Render

---

# 🏗 System Architecture

```plaintext
Passenger App
       ↓
Firebase Authentication
       ↓
Realtime Database ← GPS Tracking Engine
       ↓
Firestore Database
       ↓
AI ETA Prediction Engine
       ↓
Google Maps & Route APIs
       ↓
Admin Dashboard
```

---

# 📱 Modules

## Passenger App
- Search buses
- Track buses live
- Book tickets
- View ETA
- Receive alerts

## Driver GPS Module
- Sends realtime GPS data
- Updates trip status
- Emergency reporting

## Admin Dashboard
- Monitor live buses
- Route analytics
- Delay monitoring
- Fleet management

---

# 🚏 City Bus Integration

The platform also includes a dedicated Bidar City Bus module with:
- Local route search
- Nearby stops
- Realtime local bus tracking
- Arrival countdown
- Smart city mobility support

---

# 📂 Folder Structure

```bash
src/
 ├── components/
 ├── pages/
 ├── layouts/
 ├── hooks/
 ├── services/
 ├── firebase/
 ├── store/
 ├── animations/
 ├── constants/
 ├── mock/
 ├── maps/
 ├── utils/
 ├── types/
 └── assets/
```

---

# 🔥 Firebase Structure

## Firestore Collections

```plaintext
users/
routes/
buses/
tickets/
alerts/
searchHistory/
stations/
```

## Realtime Database

```plaintext
liveTracking/
   busId/
      latitude
      longitude
      speed
      eta
      nextStop
      delay
      updatedAt
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone <repository-url>
cd yatra-karnataka
```

## Install Dependencies

```bash
npm install
```

## Start Development Server

```bash
npm run dev
```

---

# 🔑 Environment Variables

Create `.env` file:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_MAPS_API_KEY=
```

---

# 📊 Future Scope

- Karnataka-wide deployment
- AI crowd prediction
- Smart traffic management
- Metro integration
- EV bus integration
- Voice assistant support
- Smart bus stop systems

---

# 🎯 Project Vision

To build a smart, scalable, and AI-powered public transportation ecosystem for Karnataka that improves commuter convenience, operational efficiency, and smart city mobility infrastructure.

---

# 👨‍💻 Developed For

Smart Karnataka Transit & Mobility Ecosystem

---

# 📜 License

This project is developed for educational, innovation, and smart mobility purposes.
