'use client';

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  Link,
  Breadcrumbs,
} from '@mui/material';
import { ArrowLeft as ArrowBackIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft';
import { useRouter } from 'next/navigation';

export default function TermsOfUsePage() {
  const router = useRouter();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        py: 4,
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 2,
            backgroundColor: 'white',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          }}
        >
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Breadcrumbs sx={{ mb: 2 }}>
              <Link
                component="button"
                variant="body2"
                onClick={() => router.back()}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  textDecoration: 'none',
                  color: 'black',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                <ArrowBackIcon size={16} />
                Back
              </Link>
            </Breadcrumbs>
            
            <Typography variant="h3" component="h1" sx={{ 
              fontWeight: 700, 
              color: '#00272f',
              mb: 1
            }}>
              Terms of Use
            </Typography>
            
            <Typography variant="body1" sx={{ 
              color: '#64748b',
              mb: 2
            }}>
              Last updated: {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Typography>
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* Content */}
          <Box sx={{ '& > *': { mb: 3 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#00272f', mb: 2, textAlign: 'center' }}>
              HANDIT.AI TERMS OF SERVICE
            </Typography>
            
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 3, textAlign: 'center' }}>
              Effective Date: May 8th, 2025
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              PLEASE READ THESE TERMS OF SERVICE CAREFULLY
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontWeight: 600 }}>
              THIS IS AN IMPORTANT LEGALLY BINDING AGREEMENT.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              THESE TERMS ARE ENTERED INTO BETWEEN HANDIT.AI, INC. ("HANDIT.AI", "WE", OR "OUR") AND YOU OR ANY ENTITY OR INDIVIDUAL YOU ARE AUTHORIZED TO REPRESENT (COLLECTIVELY "CUSTOMER", "YOU", OR "YOUR"). ALL CAPITALIZED TERMS HAVE THE MEANING DEFINED BELOW IN THESE TERMS OR, IF APPLICABLE, IN THE ORDER FORM.
            </Typography>

            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontWeight: 600 }}>
              READ THESE TERMS CAREFULLY BEFORE ACCESSING OR USING OUR SERVICES.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              YOU MUST AFFIRMATIVELY ACCEPT THESE TERMS WHEN SIGNING UP FOR A HANDIT.AI ACCOUNT AND, IF APPLICABLE, PAY THE FEES AS SET FORTH ON HANDIT.AI'S WEBSITE, AVAILABLE AT{' '}
              <Link href="https://handit.ai/pricing" target="_blank" rel="noopener noreferrer" sx={{ color: '#02f7aa' }}>
                https://handit.ai/pricing
              </Link>
              , IN ORDER TO ACCESS OR USE OUR SERVICES.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              IF YOU DO NOT ACCEPT THESE TERMS, OR IF YOU ACCEPT THESE TERMS AND FAIL TO PAY ANY REQUIRED FEES, YOU MAY NOT ACCESS OR USE OUR SERVICES, AND WE RESERVE THE RIGHT TO TERMINATE YOUR USE OF OUR SERVICES.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              BY ACCESSING OR USING OUR SERVICES, YOU AGREE TO BE BOUND BY THESE TERMS AND CONSENT TO THE COLLECTION AND USE OF YOUR INFORMATION IN ACCORDANCE WITH HANDIT.AI'S PRIVACY POLICY, AVAILABLE AT{' '}
              <Link href="https://handit.ai/privacy-policy" target="_blank" rel="noopener noreferrer" sx={{ color: '#02f7aa' }}>
                https://handit.ai/privacy-policy
              </Link>
              , AND INCORPORATED HEREIN BY REFERENCE.
            </Typography>

            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              These Terms of Service ("Terms") govern your access to and use of our platform, products, services, and applications ("Services"). By accessing or using our Services, you agree to these Terms, as well as our Privacy Policy and any other applicable policies or terms referenced herein.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontWeight: 600 }}>
              IF YOU DO NOT AGREE WITH THESE TERMS, PLEASE DISCONTINUE USE OF OUR SERVICES IMMEDIATELY.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              These terms include provisions in this document as well as those in the Privacy Policy and related policies of handit.ai. By using and participating in any such Services, you agree to also comply with these Additional Terms ("Additional Terms").
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              Contact Information
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              For questions, concerns, or notices, contact us at:
            </Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7 }}>
                Email: <Link href="mailto:support@handit.ai" sx={{ color: '#02f7aa' }}>support@handit.ai</Link>
              </Typography>
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              1. Acceptance of Terms
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              By creating an account, accessing, or using the Services, you agree to these Terms. If you do not agree with any part of these Terms, you must discontinue use of the Services.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              2. Modifications to Terms
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              handit.ai reserves the right to update these Terms as necessary. If changes are made, we will notify users via email, website notification, or other reasonable means. Continued use of the Services following changes constitutes acceptance of the updated Terms. If you do not agree with the modifications, you must stop using the Services.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              3. Privacy and Data Use
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              Your privacy is a priority at handit.ai. Please refer to our{' '}
              <Link href="/privacy-policy" sx={{ color: '#02f7aa' }}>Privacy Policy</Link>
              {' '}for information on how we collect, use, and protect personal and business data, including data related to AI models, performance metrics, and feedback.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              4. Eligibility and Account Responsibilities
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              To use handit.ai, you must be at least 18 years of age, or have parental or guardian consent if between 13 and 18 years old. You are responsible for:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Providing accurate and up-to-date information.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Maintaining the security of your account and password.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Promptly notifying us of any unauthorized access to your account.
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              You may not share your account with others or transfer your account to another party without our prior written consent. handit.ai is not liable for any unauthorized access resulting from your failure to safeguard your login credentials.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              5. Permitted Use of Services
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              handit.ai grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Services for your internal business purposes and in compliance with applicable laws and regulations.
            </Typography>
            
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              5.2. Prohibited Activities:
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              You may not:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Copy, distribute, or disclose any part of the Services in any medium.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Attempt to decompile, reverse engineer, disassemble, or derive source code from any part of the Services.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Use the Services for any unlawful, unauthorized, or commercial purpose outside of your own business.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Bypass any measures used to restrict access to or protect the Services.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Interfere with or disrupt the integrity of the Services.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                "crawls," "scrapes," or "spiders" any page, data, or portion of or relating to the Services or Content (through use of manual or automated means);
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                copies or stores any significant portion of the Content; or
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                decompiles, reverse engineers, or otherwise attempts to obtain the source code or underlying ideas or information of or relating to the Services.
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              Violations may lead to suspension or termination of your account.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              6. License to User-Provided Content
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              6.1 License Scope
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              6.1.1. Pilot License
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Subject to compliance with these Terms, handit.ai grants each customer and their authorized users 
              limited, non-exclusive, non-transferable, non-sublicensable, royalty-free license to access and use handit.ai's Application and proprietary tools during the Pilot Program for internal, non-commercial purposes. This Pilot License is intended solely for the customer's internal evaluation of handit.ai's platform and services and to integrate custom AI models as outlined in the customer's specific project plan.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              6.1.2. handit.ai Open-Source (Self-Service)
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Subject to compliance with these Terms, handit.ai grants users of the Freemium Tier a limited, non-exclusive, non-transferable, non-sublicensable, royalty-free license to access and use basic features of handit.ai's Application. This license includes access to:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Basic Monitoring and Manual Validation:</strong> Users may monitor and manually validate outputs for up to two AI models.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Purpose:</strong> The handit.ai Tier is intended to allow users an introductory experience with handit.ai's platform, with the option to upgrade to paid tiers as their needs evolve.
              </Typography>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              6.1.3. Growth Tier License ($XXX/month)
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Upon timely payment of applicable fees and compliance with these Terms, users of the Growth Tier are granted a limited, non-exclusive, non-transferable, non-sublicensable license to access advanced monitoring and validation tools. This license includes:
            </Typography>
            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Hybrid Validation:</strong> Access to hybrid validation for up to 1,000 outputs per month, combining manual checks with automatic validation performed by handit.ai's team for enhanced efficiency.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Advanced Monitoring:</strong> Support for monitoring up to five AI models with access to real-time performance data, drift detection, and accuracy tracking.
              </Typography>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              6.1.4. Enterprise Tier License ($XXXX/month)
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Subject to these Terms, handit grants Customer a worldwide, non-exclusive, non-transferable, revocable license to use the Enterprise tier. This premium offering combines unlimited scale, advanced automation, and white‑glove support:
            </Typography>
            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Unlimited AI Agents & Workflows:</strong> Monitor and optimize as many agents, multi-agent pipelines, models, and evaluation entries as needed.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Real-Time Optimization & Live Switching:</strong> Continuous pipelines that automatically route traffic to the best-performing prompts or models.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Custom Evaluation & Deployment:</strong> Define your own metrics, CI/CD workflows, and retraining loops with feedback-driven dataset tuning.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>KPI‑Aligned Reporting:</strong> ROI dashboards and non-technical interfaces for ops, CX, and product teams.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Self‑Hosting & Integrations:</strong> Support for on-premises deployment and connectors for Snowflake, BigQuery, S3, and more.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Dedicated Onboarding & Support:</strong> Personalized implementation, private Slack channel, and expert consulting for KPI design and rollout planning.
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontStyle: 'italic' }}>
              Fees and service levels are set forth in the applicable Order Form. Material changes require mutual agreement and thirty (30) days' prior notice.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              6.2. Use Restrictions
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Customers agree not to:
            </Typography>
            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Modify, alter, or create derivative works based on handit.ai's Application or Services.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Reverse engineer, decompile, or attempt to derive the source code or underlying algorithms.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Use any automated means (e.g., bots, scrapers) to access handit.ai's platform.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Use the Application beyond the agreed usage limits outlined in the customer's applicable Product Plan.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Engage in activities that violate any applicable laws or handit.ai's privacy policies.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Redistribute, sublicense, or otherwise make handit.ai's Application available to external third parties without written permission.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Use the Application to monitor or analyze data related to inappropriate or unlawful content.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Access handit.ai's platform or Services to build competitive products or services.
              </Typography>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              6.3. Third-Party Integrations
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              handit.ai's Application may integrate with third-party services or customer-specific components, such as proprietary databases. By establishing an integration, the customer authorizes handit.ai to interact with these components for the purposes of delivering and supporting the Services. Customers remain responsible for obtaining all necessary third-party permissions, licenses, and compliance with applicable terms and policies.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              6.4. handit.ai Licensing Rights
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              You grant handit.ai a worldwide, non-exclusive, royalty-free license to host, copy, process, transmit, and display your Customer Data only as necessary to provide the Services to you, to comply with your requests, and to improve or enhance our Services in accordance with our Privacy Policy.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              7. Payment, Billing, and Fees
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.1. Types and Tiers of Payments
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              handit.ai offers both free and paid service tiers.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2. Paid Services
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Certain handit.ai Services may be subject to payment now or in the future (the "Paid Services"). Please refer to our Paid Services page for a description of current Paid Services and associated fees. Any payment terms presented during sign-up or use of a Paid Service are considered part of these Terms.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.1. Billing
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              We use a third-party payment processor (the "Payment Processor") to bill you through a payment account linked to your handit.ai account (your "Billing Account") for use of Paid Services. Payments are subject to the terms, conditions, and privacy policies of the Payment Processor in addition to these Terms. handit.ai is not responsible for any errors or actions of the Payment Processor. By choosing Paid Services, you agree to pay handit.ai, through the Payment Processor, all charges at the current rates for such Paid Services in accordance with the applicable payment terms. You authorize us, through the Payment Processor, to charge your chosen payment provider (your "Payment Method"). You agree to make payment using that selected Payment Method. We reserve the right to correct any errors or mistakes made by the Payment Processor even if payment has already been requested or received.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.2. Payment Method
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              The Customer agrees to provide handit.ai with a valid credit or debit card issued by a U.S. bank to be stored on file and authorized for charges related to the Services. handit.ai will use this card information to initiate payment at the beginning of each service period (monthly or annual). handit.ai may obtain pre-approval on the card account for an amount up to the service payment amount specified in this Agreement. If the Customer opts for recurring automatic payments based on the level of Service utilized, all charges and fees will be billed to the account designated during the setup process.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.3. Updating Payment Information
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              If the Customer wishes to designate a different payment account or update their payment information, they must promptly provide the new details. handit.ai may temporarily delay online payments while verifying the updated payment information.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.4. Customer Representations
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              The Customer represents and warrants that:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (i) Any credit or debit card and bank account information supplied is true, accurate, and complete.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (ii) Charges incurred will be honored by the Customer's card company or bank.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (iii) The Customer will pay charges in the amounts posted, including any applicable taxes.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (iv) The Customer is authorized to make purchases or other transactions using the provided payment information.
              </Typography>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.5. Invoices
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              If the Customer does not provide valid payment information, or if handit.ai is unable to process the payment, handit.ai will issue an invoice at the beginning of each service period (monthly or annual). The Customer agrees to pay all invoiced amounts within fifteen (15) calendar days of the invoice date.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.6. Overdue Charges
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              If handit.ai does not receive payment by the due date, handit.ai may, at its discretion, apply a late fee at the rate of one and a half percent (1.5%) of the outstanding balance per month, or the maximum rate permitted by law, whichever is lower, from the date the payment was due until it is received in full.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.7. Suspension of Services
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              If any amounts owed by the Customer are overdue by ten (20) days or more, handit.ai reserves the right, without limiting any other available rights and remedies, to suspend the Customer's and its Users' access to the Services or Application until such amounts are paid in full.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.8. Recurring Billing
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Some Paid Services may include an initial one-time charge, followed by recurring charges as agreed by you. By selecting a recurring payment plan, you acknowledge that the Services include a recurring payment feature, and you accept responsibility for all recurring charges prior to cancellation.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontWeight: 600 }}>
              HANDIT.AI MAY SUBMIT PERIODIC CHARGES (E.G., MONTHLY) WITHOUT FURTHER AUTHORIZATION FROM YOU, UNTIL YOU PROVIDE NOTICE (RECEIPT CONFIRMED BY HANDIT.AI) THAT YOU HAVE TERMINATED THIS AUTHORIZATION OR WISH TO CHANGE YOUR PAYMENT METHOD. Notice will not affect charges submitted before handit.ai could reasonably act. To terminate your authorization or change your Payment Method, visit your account settings.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.9. Current Information Required
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontWeight: 600 }}>
              YOU MUST PROVIDE CURRENT, COMPLETE, AND ACCURATE INFORMATION FOR YOUR BILLING ACCOUNT. PROMPTLY UPDATE YOUR BILLING INFORMATION (SUCH AS ADDRESS, CREDIT CARD NUMBER, OR EXPIRATION DATE) AND INFORM US OR THE PAYMENT PROCESSOR OF ANY PAYMENT METHOD CANCELLATION (E.G., DUE TO LOSS OR THEFT) OR POTENTIAL SECURITY BREACH, SUCH AS UNAUTHORIZED DISCLOSURE OR USE OF YOUR USERNAME OR PASSWORD. CHANGES CAN BE MADE IN ACCOUNT SETTINGS.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontWeight: 600 }}>
              IF YOU FAIL TO PROVIDE UPDATED BILLING INFORMATION, HANDIT.AI MAY CONTINUE CHARGING YOU FOR PAID SERVICES UNDER YOUR BILLING ACCOUNT UNLESS YOU TERMINATE AS SET FORTH ABOVE.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.10. Change in Amount Authorized
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              If the amount to be charged to your Billing Account differs from the preauthorized amount (excluding state sales tax changes), you will receive notice of the charge amount and date before the scheduled transaction date. Agreements with your payment provider govern use of your Payment Method, and handit.ai may aggregate charges incurred within a billing cycle.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.11. Auto-Renewal for Paid Services
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Unless you opt-out of auto-renewal through your account settings, any Paid Services will automatically renew for successive terms of the same duration at the then-current non-promotional rate. You may change or cancel Paid Services at any time in your account settings. If you terminate a Paid Service, it will remain active until the end of the current term and will not renew. Note: you are not eligible for a prorated refund for unused portions of a subscription period.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontWeight: 600 }}>
              IF YOU DO NOT WISH TO CONTINUE CHARGES ON A RECURRING MONTHLY BASIS, CANCEL THE PAID SERVICE THROUGH YOUR ACCOUNT SETTINGS OR TERMINATE YOUR HANDIT.AI ACCOUNT BEFORE THE END OF THE RECURRING TERM. PAID SERVICES CANNOT BE TERMINATED BEFORE THE END OF THE PAID PERIOD, AND HANDIT.AI WILL NOT REFUND ANY FEES EXCEPT AS EXPRESSLY PROVIDED HEREIN.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              If handit.ai terminates your account for convenience (and not due to your breach), we will refund any pre-paid fees covering the period after termination.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              7.2.12. Reaffirmation of Authorization
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              Non-termination or continued use of a Paid Service reaffirms handit.ai's authorization to charge your Payment Method. These charges may be submitted for payment, and you are responsible for them. This does not waive our right to seek payment directly. Charges may be payable in advance, in arrears, per usage, or as described when you initially selected the Paid Service.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              8. Representation and Warranties
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              8.1. Disclaimer
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontWeight: 600 }}>
              HANDIT.AI PROVIDES THE SERVICES ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE FULLEST EXTENT PERMITTED BY LAW, HANDIT.AI DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES OR THE LIMITATION OF LIABILITY FOR CERTAIN DAMAGES. IN THOSE JURISDICTIONS, OUR LIABILITY WILL BE LIMITED TO THE GREATEST EXTENT PERMITTED BY LAW.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              handit.ai does not guarantee:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Continuous, uninterrupted, or secure access to the Services.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                That any data or content provided through the Services will be accurate, reliable, complete, or up-to-date.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                That any errors, omissions, or technical issues within the Services will be corrected.
              </Typography>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              8.2.1. Mutual Representations and Warranties
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Each Party represents and warrants to the other that:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (a) It is duly organized, validly existing, and in good standing as a corporation or other entity under the laws of its jurisdiction of incorporation or organization.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (b) The execution, delivery, and performance of this Agreement have been duly authorized by all necessary corporate or organizational actions on its part.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (c) When executed by both Parties, this Agreement will constitute a legal, valid, and binding obligation, enforceable against that Party in accordance with its terms.
              </Typography>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              8.2.2. Representations and Warranties by Customer
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              The Customer represents, warrants, and covenants to handit.ai that:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (a) The Customer owns or has all necessary rights and consents regarding the Customer Data (Customer Data ("any data, content, or materials you provide or input into the Services") and any Customer Components ("any systems, models, or tools you connect to or use with the Services") necessary to authorize handit.ai's access and use of such Customer Data and Components in accordance with this Agreement.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                (b) The Customer Data do not, and will not, infringe, misappropriate, or otherwise violate any intellectual property, privacy, or other rights of any third party, nor do they violate any applicable laws, including those outlined in the Privacy Policy.
              </Typography>
            </Box>

            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              Your use of the Services and reliance on any information provided by handit.ai is at your own risk.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              10. Indemnification
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              You agree to indemnify, defend, and hold harmless handit.ai and its officers, directors, employees, agents, and affiliates from any claims, liabilities, damages, losses, or expenses (including reasonable attorneys' fees) arising out of:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Your use of the Services.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Any violation of these Terms.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Any alleged infringement or misappropriation of third-party rights.
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              handit.ai reserves the right to assume the exclusive defense and control of any matter subject to indemnification, and you agree to cooperate with us in such defense.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              11. Subscriptions; Cancellation
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              11.1. Subscriptions
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              By signing up for an account to access handit.ai's Application under the Freemium, Growth, or Enterprise Product Plans, and subject to the receipt of corresponding payment for the Growth and Enterprise Plans, the Customer's subscription to the applicable Product Plan automatically begins on the date of activation.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Upgrades and Management:</strong> Customers may upgrade, downgrade, or manage their Product Plan subscription by accessing their account's billing settings within the Application. Any changes are subject to approval by handit.ai and will take effect as per the terms outlined for each Product Plan.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Automatic Renewal:</strong> Customer subscriptions for the Freemium, Growth, and Enterprise Plans automatically renew for each successive billing period as per the selected plan, unless the Customer provides handit.ai with written notice of intent not to renew at least 15 days before the expiration of the current term. The Customer authorizes handit.ai to automatically charge the applicable fees on or after the start date of each successive subscription period unless the Product Plan is canceled in accordance with this Section 12.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Annual Subscriptions:</strong> For Enterprise Plans or any other long-term agreements, subscriptions continue for one (1) year from the purchase date and automatically renew for successive one-year terms unless terminated under this Agreement or either Party provides written notice of non-renewal at least 30 days before the expiration of the then-current term.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              11.2. Termination
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              In addition to other express termination rights set forth in this Agreement:
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>By handit.ai:</strong> handit.ai may terminate this Agreement by providing written notice to the Customer if: (i) the Customer fails to pay any undisputed amount when due, and such failure persists more than 15 days after handit.ai provides written notice; or (ii) the Customer breaches any obligations under Section 2 (Use Restrictions), Section 3 (Data Privacy), or Section 7 (Payment).
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Inactive Accounts:</strong> For Freemium accounts, handit.ai may terminate this Agreement and delete the Customer's account if the Customer has not logged into their account for more than 90 days.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              11.3. Effects of Termination
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Upon expiration or termination of this Agreement, unless expressly stated otherwise:
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Termination of Rights:</strong> All rights, licenses, consents, and authorizations granted by handit.ai to the Customer will immediately terminate.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Cessation of Use:</strong> The Customer must immediately cease all use of handit.ai's Services, Application, and any proprietary materials.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Return or Destruction of Confidential Information:</strong> The receiving party must promptly return or, at the disclosing party's written request, destroy all documents and materials containing, reflecting, incorporating, or based on the other party's Confidential Information. Additionally, any Confidential Information stored in systems must be permanently erased, except for a single copy retained solely to determine obligations under this Agreement. The receiving party must certify compliance with this requirement in a signed written statement.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              <strong>Outstanding Fees:</strong> All outstanding fees and previously accrued but unpaid fees will become immediately due and payable.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              12. Dispute and Waiver of Class Actions
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              12.1. Forum Selection
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Any dispute, claim, or controversy arising out of or relating to these Terms or the Services shall be brought exclusively in the state courts of COUNTY OF KINGS, NEW YORK, or the United States District Court for the Eastern District of New York. Each party irrevocably submits to the personal jurisdiction and venue of these courts and waives any objection based on inconvenient forum or venue.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              12.2. Class Action Waiver
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3, fontWeight: 600 }}>
              YOU AGREE NOT TO PARTICIPATE IN ANY CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION. ALL CLAIMS MUST BE ARBITRATED OR LITIGATED ON AN INDIVIDUAL BASIS, AND YOU EXPRESSLY WAIVE THE ABILITY TO BRING CLAIMS AS A CLASS OR GROUP.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              13. Termination of Services
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              handit.ai may suspend or terminate your access to the Services at any time, for any reason, without prior notice. If your account is terminated, certain provisions of these Terms (e.g., intellectual property rights, disclaimers, indemnity, and limitation of liability) will survive termination.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              14. Governing Law and Jurisdiction
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              These Terms are governed by the laws of the State of NEW YORK, without regard to its conflicts of law provisions. For any claims not subject to arbitration, you agree to submit to the exclusive jurisdiction of the courts located in NEW YORK, NEW YORK.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              15. Additional Provisions
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Assignment:</strong> You may not assign your rights or obligations under these Terms without our prior written consent. handit.ai may assign its rights and obligations without restriction.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Entire Agreement:</strong> These Terms, along with the Privacy Policy, represent the entire agreement between you and handit.ai regarding the Services.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Severability:</strong> If any provision of these Terms is found unenforceable, it shall be modified to the minimum extent necessary, and the remaining provisions will remain in full effect.
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              <strong>No Waiver:</strong> handit.ai's failure to enforce any part of these Terms shall not constitute a waiver of our right to enforce that or any other part of these Terms.
            </Typography>

            <Divider sx={{ mb: 3 }} />
            
            <Typography variant="body1" sx={{ 
              color: '#64748b', 
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              Last Updated: May 8th, 2025
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
