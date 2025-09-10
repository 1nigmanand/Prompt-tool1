import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Firebase service account configuration
const serviceAccount = {
  type: "service_account",
  project_id: "prompt-proj1",
  private_key_id: "552111d9ba3c5d73511c005848ae0cceb40e91ae",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC3DA6CSoWPCZlx\nfS0/OYshKf2mP4BhqXJKK+tu4QkqxUBV7Upe1SizOhJdsYPQxhpQLsEU0QqHa3hq\nx/o/ULLOybsM420kwTAwx0dGcsV99+/2zACcyPG6NQyBEpbnRQwcFA2wL8t0jJvD\n06nZSCXZqwdLKjQG6Xua/HKjrgY5sQnJC8i+qTmHoCCrb5HhM4EbzQyehcO920l1\n+6xnAH03cRMqT9HDQVDfYuhtOyTewUcC1OCjJFEUGJcpr46jYqpokH0KsPKuvBqE\nTPi5a4v7r8jluTaAWLHh7ZaxyqOGFbnwpXhPhe0msm6NqqycU2Jo0UvvUxffTj3N\nxSQx0EYnAgMBAAECggEAN66TO08wEbL52mwZt4HpsMz1O/1VMGA7RBTYKYKLJ1eZ\nmon0daSiHOMtcxLs5jVdC8ctNQfiDA/FMbZjiZ8ixYTYQbNtICEkZ7I3HFcNfKRP\neuPTy93UqrA4fYsKHJAEfwYao93mJi4ftBJPOKmZ2f0M2vCbov6jeyIQPXpSqnmM\ndBvGnQrEEaVtrj4B3woXdunq1VbAhGvvpINRidvp4S7UGGx6sU7fzYiomOrwHFRa\nIxx/4G26kn1126HF357Ufl9b5xOflhvNGU+cbbqLRTHg7iwoaWNtNN8wwenZC5rb\nmcGH5WNOTF+w4itHKUQb0eSK2PoXSGR0dwkPscU6AQKBgQDlatsqGXecnQI8fJdO\ntB6VK5/d1KIGDQIpjSULcE5wKimyrR0GmEH8o/11z26qKAkZtSDUxmmtDEEY0QD3\n6u42HU2MJIkPnWq6XMhUwYw76fqHqbO6X4CCI2btMyEkfoUJLhWdPIjbBAYWhaGt\nToxr36R19YfiV0RHZC/D2rmaTwKBgQDMQbsqctbJV2Mjn0kOne4BtCpIr5IZYwZ6\ngrAhaSsEdb6uDxDaZnUKuXBCG7Li/ilNDbiHLRf7jX3OkENSFHB/bLOa72hQqC7R\nS7iMK1pEJ+8de/TCHjoa4vAx54PBu7OGlPy6HLToboNJoB96UIJGYbj/68JfAH3h\ng4C+gY4YqQKBgQDFkpjcUMJp5e2fGc1Uwln0LXWoHQ7MFzfdgOh+SWHDxwvSDLQK\nkeWCJdiKNPIhKAluUkbL93Pay8rkDFrBJ1mu0N2P64b+I5tek7kTBPw4PPC9FLDr\nuIN7j/F8JaRNQYhgt4d1ukRCGd0EWGE8V4EnBZsk2ycDDhSHRwi7qwpckQKBgQCV\nRpSa+UKv8wWpSwgBfroq1Jjydh24H/7kGg7O3CVsJQEuBCS0+JwhMlUwez3JVyao\nAZcSc4pLdaS0CgqpOfbdqXu5h64dBEzy+PvutOBLX0QJsEW4eI7Oh3wzfJd2Rs91\nU/0/pysvk1Svwi4/HgeXmGOz5YEwHRPidFDq6ZQHwQKBgQDiAr4DyvXInxfGfSCN\n3lFmrSs28wo8fiRn/BaRSoE3uChm8/3SipfuWG1YimkgD3XUz6Yxz+/awDGDula4\n/3/+Ga4kRjyBgRTafjueyvjJL7gVteDHx3aoggItTktnferZSPheRiUFVZrPIgi4\n5Lm/V5MJClKFFB5WuRLRcG6MCQ==\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@prompt-proj1.iam.gserviceaccount.com",
  client_id: "108705772520164864562",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40prompt-proj1.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Initialize Firebase Admin SDK
const app = getApps().length === 0 
  ? initializeApp({
      credential: cert(serviceAccount as any),
      projectId: 'prompt-proj1'
    })
  : getApp();

// Export Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

console.log('🔥 Firebase Admin SDK initialized successfully');
