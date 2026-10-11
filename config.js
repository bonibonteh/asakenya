/* ASA Kenya - public site settings
   The Supabase URL and the PUBLISHABLE key are designed to be public: every visitor's
   browser needs them, and the database access rules (Row Level Security) are what protect the data.
   NEVER put a secret key, service_role key or database password in this file or anywhere in this repo. */
window.ASA_CONFIG = {
  SUPABASE_URL: 'https://olzjxdyadshfqxadisww.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_LTnYqBGGFJUHkveZI_Uf7g_fei5TT3t', /* public by design (Supabase -> Project Settings -> API Keys). Never put the secret key here. */
  OPPORTUNITY_BUCKET: 'opportunity-files',
  /* Official bodies for the Graduate Hub roadmap. Leave '' until a link is confirmed; the page then says "link to be confirmed". */
  OFFICIAL_LINKS: {
    AAK: 'https://aak.or.ke/membership',
    BORAQS: ''
  }
};
