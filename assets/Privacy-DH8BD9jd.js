import{r as a,j as e}from"./vendor-motion-DMlLQ8XX.js";import{s as f,L as d}from"./index--GqR81uG.js";import{B as o,C as h,b as g,c as y,a as v}from"./card-D4JraxM3.js";import{S as w}from"./separator-tNcngo4D.js";import{A as P}from"./arrow-left-CMvyXNaX.js";import"./vendor-radix-BVIvAzO8.js";import"./vendor-supabase-Dbly6DSp.js";import"./vendor-charts-9CPCblrA.js";const j=()=>{const[l,i]=a.useState(""),[u,n]=a.useState(""),[p,r]=a.useState("");a.useEffect(()=>{m()},[]);const m=async()=>{try{const{data:t,error:c}=await f.from("agreement_versions").select("*").eq("type","privacy").order("effective_date",{ascending:!1}).limit(1).single();if(c)throw c;i(t.content),n(t.version),r(new Date(t.effective_date).toLocaleDateString())}catch(t){console.error("Error fetching privacy policy:",t),i(s()),n("1.0"),r(new Date().toLocaleDateString())}},s=()=>`
# Privacy Policy

**Effective Date:** ${new Date().toLocaleDateString()}
**Version:** 1.0

## 1. Introduction

Welcome to JOOD AI ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered personal assistant application.

## 2. Information We Collect

### 2.1 Personal Information
We collect the following types of personal information:

**Account Information:**
- Email address (required for account creation)
- Display name or username
- Password (encrypted and securely stored)
- Profile preferences and settings

**Financial Data:**
- Transaction records you choose to track
- Portfolio holdings and investment information
- Financial goals and budgets
- Income and expense categories
- Currency preferences

**Usage Data:**
- Chat conversations with our AI assistant
- Task and goal entries
- Mood tracking entries
- Voice interactions (processed locally when possible)
- App usage analytics and performance data

### 2.2 Automatically Collected Information
**Technical Information:**
- IP address and location data
- Device information (type, operating system, version)
- Browser type and version
- App usage patterns and feature interactions
- Error logs and crash reports

**Analytics Data:**
- Session duration and frequency
- Feature usage statistics
- Performance metrics
- User engagement patterns

### 2.3 Third-Party Information
We may receive information from:
- Payment processors (for subscription management)
- Social media platforms (if you connect accounts)
- Financial data providers (with your consent)
- App stores (download and purchase information)

## 3. How We Use Your Information

### 3.1 Service Provision
- Providing personalized AI assistance and recommendations
- Managing your financial tracking and portfolio data
- Enabling task management and productivity features
- Processing mood tracking and wellness insights
- Facilitating voice interactions and commands

### 3.2 Account Management
- Creating and maintaining your user account
- Processing subscription payments and billing
- Providing customer support and technical assistance
- Sending service-related notifications and updates

### 3.3 Improvement and Analytics
- Analyzing usage patterns to improve our services
- Developing new features and capabilities
- Conducting research and development
- Performing security monitoring and fraud prevention

### 3.4 Communication
- Sending important service updates and notifications
- Providing customer support responses
- Sharing product updates and new features (with consent)
- Marketing communications (only with explicit consent)

## 4. Information Sharing and Disclosure

### 4.1 We Do Not Sell Your Data
We do not sell, rent, or trade your personal information to third parties for their commercial purposes.

### 4.2 Service Providers
We may share information with trusted service providers who assist us in:
- Cloud hosting and data storage (encrypted)
- Payment processing (Stripe)
- Analytics and performance monitoring
- Customer support tools
- AI model training and improvement (anonymized data only)

### 4.3 Legal Requirements
We may disclose information when required by law or to:
- Comply with legal processes or government requests
- Protect our rights, property, or safety
- Prevent fraud or security threats
- Enforce our Terms of Service

### 4.4 Business Transfers
In the event of a merger, acquisition, or sale of assets, user information may be transferred as part of the transaction, subject to equivalent privacy protections.

## 5. Data Security and Protection

### 5.1 Security Measures
We implement industry-standard security measures:
- End-to-end encryption for sensitive data
- Secure data transmission (HTTPS/TLS)
- Regular security audits and penetration testing
- Access controls and authentication systems
- Data backup and disaster recovery procedures

### 5.2 Data Storage
- Data is stored in secure, encrypted databases
- Financial information receives additional security layers
- Chat conversations are encrypted both in transit and at rest
- Voice data is processed locally when possible

### 5.3 Data Retention
- Account data is retained while your account is active
- Financial data is retained for tax and legal compliance periods
- Chat history can be deleted by users at any time
- Anonymized analytics data may be retained longer for service improvement

## 6. Your Privacy Rights

### 6.1 Access and Control
You have the right to:
- Access your personal data and download a copy
- Correct inaccurate or incomplete information
- Delete your account and associated data
- Export your data in a portable format
- Opt-out of non-essential data collection

### 6.2 Communication Preferences
- Unsubscribe from marketing communications
- Control notification settings
- Manage cookie preferences
- Opt-out of analytics tracking (where technically feasible)

### 6.3 Data Deletion
You can request deletion of:
- Your entire account and all associated data
- Specific types of data (e.g., financial records, chat history)
- Historical data older than a certain period
- Data shared with specific third-party integrations

## 7. Cookies and Tracking Technologies

### 7.1 Types of Cookies
We use the following types of cookies:
- **Essential Cookies:** Required for basic app functionality
- **Analytics Cookies:** Help us understand app usage patterns
- **Preference Cookies:** Remember your settings and preferences
- **Performance Cookies:** Monitor app performance and stability

### 7.2 Cookie Management
You can control cookies through:
- Browser settings and preferences
- App-specific privacy controls
- Third-party analytics opt-out mechanisms
- Cookie consent management tools

## 8. Children's Privacy

### 8.1 Age Restrictions
- Our service is not intended for children under 13
- We do not knowingly collect data from children under 13
- Parental consent is required for users aged 13-17
- We will delete data if we discover it was collected from a child under 13

### 8.2 Parental Controls
Parents and guardians can:
- Review their child's account information
- Request deletion of their child's data
- Control their child's privacy settings
- Supervise their child's app usage

## 9. International Data Transfers

### 9.1 Cross-Border Processing
- Your data may be processed in countries outside your residence
- We ensure adequate protection through standard contractual clauses
- Data transfers comply with applicable privacy laws
- EU users receive GDPR-level protection regardless of processing location

### 9.2 Regional Compliance
**For EU/EEA Users:**
- Full GDPR compliance and rights
- Data Protection Officer contact available
- Right to lodge complaints with supervisory authorities
- Lawful basis for processing clearly identified

**For California Users:**
- CCPA compliance and consumer rights
- Right to know what information is collected
- Right to delete personal information
- Right to opt-out of data sales (though we don't sell data)

## 10. Third-Party Services and Integrations

### 10.1 Payment Processing
- Stripe processes subscription payments
- We do not store credit card information
- Payment data is subject to Stripe's privacy policy
- PCI-DSS compliance for payment security

### 10.2 AI and Machine Learning
- OpenAI provides AI conversation capabilities
- Conversations may be used to improve AI models (anonymized)
- You can opt-out of data sharing for AI improvement
- Local processing is used when possible to protect privacy

### 10.3 Analytics Services
- Google Analytics for usage insights (anonymized)
- Crash reporting services for stability improvements
- Performance monitoring tools
- You can opt-out of analytics tracking

## 11. Privacy Policy Updates

### 11.1 Notification of Changes
- We will notify you of material changes via email
- In-app notifications for significant updates
- Continued use constitutes acceptance of updates
- Previous versions available upon request

### 11.2 Version Control
- All privacy policy versions are dated and archived
- Users can access historical versions
- Change logs document modifications
- Transition periods provided for major changes

## 12. Contact Information and Data Protection

### 12.1 Privacy Inquiries
For privacy-related questions or requests:
- **Email:** privacy@joudai.com
- **Data Protection Officer:** dpo@joudai.com
- **Mailing Address:** [Your Business Address]
- **Response Time:** We aim to respond within 72 hours

### 12.2 Data Subject Requests
To exercise your privacy rights:
1. Contact us using the information above
2. Provide verification of your identity
3. Specify the nature of your request
4. Allow up to 30 days for processing

### 12.3 Complaints and Escalation
If you're not satisfied with our response:
- Contact our Data Protection Officer
- File a complaint with your local privacy regulator
- Seek legal advice regarding your rights
- Use alternative dispute resolution services

## 13. Data Breach Notification

### 13.1 Our Commitments
- Immediate investigation of potential breaches
- Notification to authorities within 72 hours (where required)
- User notification without undue delay
- Detailed incident reports and remediation plans

### 13.2 User Actions
In case of a data breach:
- We will notify you via email and in-app notification
- Provide specific details about affected data
- Offer guidance on protective measures you can take
- Provide ongoing updates on our investigation and response

## 14. Consent and Legal Basis

### 14.1 Consent Management
- Clear consent requests for optional data processing
- Granular controls for different types of data use
- Easy withdrawal of consent through app settings
- Record-keeping of consent decisions and changes

### 14.2 Legal Basis for Processing
We process your data based on:
- **Contract Performance:** Providing the services you've subscribed to
- **Legitimate Interest:** Improving our services and security
- **Consent:** Marketing communications and optional features
- **Legal Compliance:** Meeting regulatory requirements

---

*Last Updated: ${new Date().toLocaleDateString()}*
*Version: 1.0*

For the most current version of this Privacy Policy, please check our website or app settings.
  `;return e.jsx("div",{className:"min-h-screen bg-gradient-primary",children:e.jsxs("div",{className:"container max-w-4xl mx-auto px-4 py-8",children:[e.jsx("div",{className:"mb-6",children:e.jsx(d,{to:"/",children:e.jsxs(o,{variant:"ghost",className:"text-white hover:bg-white/10",children:[e.jsx(P,{className:"mr-2 h-4 w-4"}),"Back to Home"]})})}),e.jsxs(h,{className:"bg-white/10 backdrop-blur-lg border-white/20",children:[e.jsxs(g,{children:[e.jsx(y,{className:"text-3xl font-bold text-white text-center",children:"Privacy Policy"}),e.jsxs("div",{className:"text-center text-white/80",children:[e.jsxs("p",{children:["Version ",u]}),e.jsxs("p",{children:["Effective Date: ",p]})]})]}),e.jsx(v,{className:"prose prose-invert max-w-none",children:e.jsx("div",{className:"text-white/90 whitespace-pre-line leading-relaxed",children:l||s()})})]}),e.jsx(w,{className:"my-8 bg-white/20"}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-white/80 mb-4",children:"Questions about your privacy? We're here to help."}),e.jsx(d,{to:"/terms",children:e.jsx(o,{variant:"outline",className:"mr-4 bg-white/10 border-white/20 text-white hover:bg-white/20",children:"Terms of Service"})}),e.jsx("a",{href:"mailto:privacy@joudai.com",children:e.jsx(o,{variant:"outline",className:"bg-white/10 border-white/20 text-white hover:bg-white/20",children:"Contact Privacy Team"})})]})]})})};export{j as default};
