import{r as a,j as e}from"./vendor-motion-DMlLQ8XX.js";import{s as h,L as l}from"./index-hrsCy8bH.js";import{B as i,C as f,b as y,c as g,a as v}from"./card-CdXEeKVy.js";import{S as b}from"./separator-Ci_RnBJB.js";import{A as w}from"./arrow-left-Disgbv5n.js";import"./vendor-radix-BVIvAzO8.js";import"./vendor-supabase-Dbly6DSp.js";import"./vendor-charts-9CPCblrA.js";const L=()=>{const[u,o]=a.useState(""),[d,n]=a.useState(""),[m,r]=a.useState("");a.useEffect(()=>{p()},[]);const p=async()=>{try{const{data:t,error:c}=await h.from("agreement_versions").select("*").eq("type","terms").order("effective_date",{ascending:!1}).limit(1).single();if(c)throw c;o(t.content),n(t.version),r(new Date(t.effective_date).toLocaleDateString())}catch(t){console.error("Error fetching terms:",t),o(s()),n("1.0"),r(new Date().toLocaleDateString())}},s=()=>`
# Terms of Service

**Effective Date:** ${new Date().toLocaleDateString()}
**Version:** 1.0

## 1. Acceptance of Terms

By accessing and using JOOD AI ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.

## 2. Description of Service

JOOD AI is an artificial intelligence-powered personal assistant application that provides:
- AI chat interactions and conversations
- Financial tracking and portfolio management
- Task planning and management
- Mood tracking and analytics
- Voice interaction capabilities

## 3. User Accounts and Registration

### 3.1 Account Creation
- You must provide accurate and complete information when creating an account
- You are responsible for maintaining the confidentiality of your account credentials
- You must be at least 13 years old to create an account
- Parental consent is required for users under 18 years of age

### 3.2 Account Responsibilities
- You are responsible for all activities that occur under your account
- You must notify us immediately of any unauthorized use of your account
- We reserve the right to terminate accounts that violate these terms

## 4. Subscription Terms and Billing

### 4.1 Subscription Plans
- Various subscription tiers may be available with different features and limitations
- Subscription fees are charged in advance on a recurring basis
- All fees are non-refundable except as required by law

### 4.2 Auto-Renewal
- Subscriptions automatically renew at the end of each billing period
- You can cancel your subscription at any time through your account settings
- Cancellations take effect at the end of the current billing period

### 4.3 Price Changes
- We may change subscription prices with 30 days' notice
- Continued use of the service after price changes constitutes acceptance

## 5. Data Privacy and Security

### 5.1 Data Collection
- We collect and process personal data as described in our Privacy Policy
- You consent to the collection and use of your data for service provision
- Financial and personal data is encrypted and securely stored

### 5.2 Data Retention
- We retain your data for as long as your account is active
- You can request data deletion by contacting support
- Some data may be retained for legal compliance purposes

## 6. Acceptable Use Policy

### 6.1 Prohibited Activities
You may not use the Service to:
- Violate any applicable laws or regulations
- Infringe on intellectual property rights
- Distribute malicious software or content
- Attempt to gain unauthorized access to our systems
- Use the service for illegal financial activities

### 6.2 Content Standards
- You are responsible for the content you input into the service
- We reserve the right to remove content that violates our policies
- Abusive or harmful content is strictly prohibited

## 7. Intellectual Property

### 7.1 Service Content
- All content and technology of the Service is owned by us or our licensors
- You are granted a limited, non-exclusive license to use the Service
- You may not copy, modify, or distribute our proprietary content

### 7.2 User Content
- You retain ownership of content you create using the Service
- You grant us a license to process and store your content for service provision
- We do not claim ownership of your personal data or content

## 8. Disclaimers and Limitations

### 8.1 Service Availability
- The Service is provided "as is" without warranties of any kind
- We do not guarantee uninterrupted or error-free service
- Maintenance and updates may temporarily affect availability

### 8.2 Financial Information Disclaimer
- The Service provides tools for financial tracking but not financial advice
- We are not responsible for financial decisions made using the Service
- Consult qualified professionals for financial planning advice

### 8.3 AI Content Disclaimer
- AI-generated responses are for informational purposes only
- We do not guarantee the accuracy of AI-generated content
- Users should verify important information independently

## 9. Limitation of Liability

To the maximum extent permitted by law:
- Our liability is limited to the amount paid for the Service
- We are not liable for indirect, incidental, or consequential damages
- Some jurisdictions do not allow liability limitations, so these may not apply to you

## 10. Indemnification

You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from:
- Your use of the Service
- Your violation of these Terms
- Your violation of any third party rights

## 11. Termination

### 11.1 Termination by You
- You may terminate your account at any time through account settings
- Subscription cancellations take effect at the end of the billing period
- Data deletion may take up to 30 days to complete

### 11.2 Termination by Us
We may terminate your account if you:
- Violate these Terms of Service
- Engage in fraudulent or illegal activities
- Abuse or misuse the Service

## 12. App Store Compliance

### 12.1 Apple App Store
If you download the app from the Apple App Store:
- These terms are between you and us, not Apple
- Apple is not responsible for the Service or these terms
- You acknowledge Apple's right to enforce these terms as a third-party beneficiary

### 12.2 Google Play Store
If you download the app from Google Play:
- These terms are between you and us, not Google
- Google is not responsible for the Service
- Google may enforce policies that affect the Service availability

## 13. International Users

### 13.1 Compliance with Local Laws
- Users are responsible for compliance with local laws and regulations
- The Service may not be available in all countries
- Export control laws may apply to the technology used in the Service

### 13.2 Governing Law
- These terms are governed by [Your Jurisdiction] law
- Disputes will be resolved in [Your Jurisdiction] courts
- EU users have additional rights under applicable consumer protection laws

## 14. Updates and Modifications

### 14.1 Terms Updates
- We may update these terms at any time
- Significant changes will be communicated via email or in-app notification
- Continued use after updates constitutes acceptance

### 14.2 Service Updates
- The Service may be updated with new features or changes
- Some updates may require acceptance of new terms
- Legacy features may be discontinued with notice

## 15. Contact Information

For questions about these Terms of Service:
- Email: legal@joudai.com
- Address: [Your Business Address]
- Support Portal: [Your Support URL]

## 16. Severability

If any provision of these terms is found to be unenforceable, the remaining provisions will remain in full force and effect.

## 17. Entire Agreement

These Terms of Service, together with our Privacy Policy, constitute the entire agreement between you and us regarding the Service.

---

*Last Updated: ${new Date().toLocaleDateString()}*
*Version: 1.0*
  `;return e.jsx("div",{className:"min-h-screen bg-gradient-primary",children:e.jsxs("div",{className:"container max-w-4xl mx-auto px-4 py-8",children:[e.jsx("div",{className:"mb-6",children:e.jsx(l,{to:"/",children:e.jsxs(i,{variant:"ghost",className:"text-white hover:bg-white/10",children:[e.jsx(w,{className:"mr-2 h-4 w-4"}),"Back to Home"]})})}),e.jsxs(f,{className:"bg-white/10 backdrop-blur-lg border-white/20",children:[e.jsxs(y,{children:[e.jsx(g,{className:"text-3xl font-bold text-white text-center",children:"Terms of Service"}),e.jsxs("div",{className:"text-center text-white/80",children:[e.jsxs("p",{children:["Version ",d]}),e.jsxs("p",{children:["Effective Date: ",m]})]})]}),e.jsx(v,{className:"prose prose-invert max-w-none",children:e.jsx("div",{className:"text-white/90 whitespace-pre-line leading-relaxed",children:u||s()})})]}),e.jsx(b,{className:"my-8 bg-white/20"}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-white/80 mb-4",children:"Have questions about our terms? Contact our legal team."}),e.jsx(l,{to:"/privacy",children:e.jsx(i,{variant:"outline",className:"mr-4 bg-white/10 border-white/20 text-white hover:bg-white/20",children:"Privacy Policy"})}),e.jsx("a",{href:"mailto:legal@joudai.com",children:e.jsx(i,{variant:"outline",className:"bg-white/10 border-white/20 text-white hover:bg-white/20",children:"Contact Legal Team"})})]})]})})};export{L as default};
