declare namespace NodeJS {
  interface ProcessEnv {
    METABASE_SITE_URL?: string;
    NEXT_PUBLIC_API_URL?: string;
    NEXT_PUBLIC_APP_NAME?: 'CFX' | 'ICC' | 'KKI' | 'ITK';
    NEXT_PUBLIC_AUTH_V3?: 'true' | 'false';
    NEXT_PUBLIC_ENV?: 'staging' | 'uat' | 'production';
    NEXT_PUBLIC_FIREBASE_API_KEY?: string;
    NEXT_PUBLIC_FIREBASE_APP_ID?: string;
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
    NEXT_PUBLIC_FPJS_API_KEY?: string;
    NEXT_PUBLIC_FPJS_DOMAIN?: string;
    NEXT_PUBLIC_FPJS_ENDPOINT?: string;
    NEXT_PUBLIC_FPJS_SCRIPT_URL?: string;
    NEXT_PUBLIC_KYE?: 'true' | 'false';
    NEXT_PUBLIC_OTP_ENABLED?: 'true' | 'false';
    NEXT_PUBLIC_PUSHER_APP_CLUSTER?: string;
    NEXT_PUBLIC_PUSHER_APP_KEY?: string;
    NEXT_PUBLIC_PUSHER_APP_NAME?: string;
    NODE_ENV: 'development' | 'production' | 'test';
    PUSHER_APP_ID?: string;
    PUSHER_APP_SECRET?: string;
    REACT_STRICT_MODE?: 'true' | 'false';
  }
}
