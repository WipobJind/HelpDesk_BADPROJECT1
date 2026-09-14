const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

async function loadSecrets() {
  const vaultUrl = process.env.AZURE_KEY_VAULT_URL;

  if (!vaultUrl || vaultUrl.includes("your-vault")) {
    console.log("No Key Vault configured — using .env values");
    return {
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
      SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
      AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
    };
  }

  console.log("Fetching secrets from Azure Key Vault:", vaultUrl);

  const credential = new DefaultAzureCredential();
  const client = new SecretClient(vaultUrl, credential);

  const [databaseUrl, jwtSecret, geminiKey, sendgridKey, sendgridFrom, adClientSecret] =
    await Promise.all([
      client.getSecret("DATABASE-URL"),
      client.getSecret("JWT-SECRET"),
      client.getSecret("GEMINI-API-KEY"),
      client.getSecret("SENDGRID-API-KEY"),
      client.getSecret("SENDGRID-FROM-EMAIL"),
      client.getSecret("AZURE-AD-CLIENT-SECRET"),
    ]);

  console.log("Secrets successfully loaded from Key Vault");

  return {
    DATABASE_URL: databaseUrl.value,
    JWT_SECRET: jwtSecret.value,
    GEMINI_API_KEY: geminiKey.value,
    SENDGRID_API_KEY: sendgridKey.value,
    SENDGRID_FROM_EMAIL: sendgridFrom.value,
    AZURE_AD_CLIENT_SECRET: adClientSecret.value,
  };
}

module.exports = { loadSecrets };
