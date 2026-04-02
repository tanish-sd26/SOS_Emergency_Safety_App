const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envFiles = [
  path.join(rootDir, '.env'),
  path.join(rootDir, 'functions', '.env'),
];

function parseEnv(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const index = line.indexOf('=');
      if (index === -1) return acc;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
}

function loadEnv() {
  const values = { ...process.env };
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, 'utf8');
      Object.assign(values, parseEnv(raw));
      break;
    }
  }
  return values;
}

const env = loadEnv();
const config = {
  firebase: {
    apiKey: env.FIREBASE_API_KEY || '',
    authDomain: env.FIREBASE_AUTH_DOMAIN || '',
    projectId: env.FIREBASE_PROJECT_ID || '',
    storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.FIREBASE_APP_ID || '',
    measurementId: env.FIREBASE_MEASUREMENT_ID || '',
  },
  emailjs: {
    publicKey: env.EMAILJS_PUBLIC_KEY || '',
    serviceId: env.EMAILJS_SERVICE_ID || '',
    templateId: env.EMAILJS_TEMPLATE_ID || '',
  },
};

const missing = [];
for (const [section, values] of Object.entries(config)) {
  for (const [key, value] of Object.entries(values)) {
    if (!value) missing.push(key);
  }
}

if (missing.length) {
  console.warn('Warning: missing env values for:', missing.join(', '));
  console.warn('Please add them to a .env file in the project root or functions folder.');
}

const output = `window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.firebase = ${JSON.stringify(config.firebase, null, 2)};
window.APP_CONFIG.emailjs = ${JSON.stringify(config.emailjs, null, 2)};
`;

const targetPath = path.join(rootDir, 'public', 'js', 'env-config.js');
fs.writeFileSync(targetPath, output, 'utf8');
console.log('Generated client config at', targetPath);
if (missing.length) {
  console.log('Run the script again after filling the missing values.');
}
