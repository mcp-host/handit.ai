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

export default function PrivacyPolicyPage() {
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
              Privacy Policy
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
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              1. Introduction
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              At handit.ai, we are committed to protecting your personal data and respecting your privacy. We value the trust you place in us and prioritize the security of your information. Please read this Privacy Policy carefully. If you have any questions or concerns, contact us at support@handit.ai. By using our website, services, or interacting with any aspect of our business, you acknowledge your understanding and agreement to this Privacy Policy. If you do not agree, we advise refraining from accessing our website or services.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              This Privacy Policy explains how handit.ai and its subsidiaries ("handit.ai," "we," "our," or "us") collect, process, store, disclose, and manage your personal data ("Personal Data"). It also outlines the choices you have regarding your data and our practices.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              2. Scope of This Privacy Policy
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              This Privacy Policy applies to handit.ai's practices concerning Personal Data as a Data Controller in connection with our website (<Link href="https://www.handit.ai/" target="_blank" rel="noopener noreferrer" sx={{ color: '#02f7aa' }}>https://www.handit.ai/</Link>), subdomains, onsite and virtual events, marketing communications (emails, newsletters, advertisements), and other linked activities. It is designed to meet the requirements of data protection laws such as the General Data Protection Regulation (GDPR), UK GDPR, the California Consumer Privacy Act (CCPA), and any relevant local privacy regulations in the regions where we operate.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, fontStyle: 'italic' }}>
              Note: When we act as a Data Processor on behalf of our clients, such data processing is governed by agreements or contracts between handit.ai and its clients, including any relevant Data Protection Agreements (DPA).
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              3. What Personal Data Do We Collect, and Why?
            </Typography>
            
            <Box sx={{ mb: 3, overflow: 'auto' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid #e2e8f0',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box component="thead" sx={{ backgroundColor: '#f8fafc' }}>
                  <Box component="tr">
                    <Box
                      component="th"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#00272f',
                        fontSize: '0.875rem',
                      }}
                    >
                      Personal Data Collected
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#00272f',
                        fontSize: '0.875rem',
                      }}
                    >
                      Purpose
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#00272f',
                        fontSize: '0.875rem',
                      }}
                    >
                      Legitimacy
                    </Box>
                    <Box
                      component="th"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#00272f',
                        fontSize: '0.875rem',
                      }}
                    >
                      Retention Period
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  <Box component="tr">
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Name, email address, phone number
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      To create and manage user accounts, provide services, and communicate regarding the services offered.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Legitimate interest in providing services and maintaining user relationships, and user consent where applicable.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Retained as long as the account remains active or as required by legal obligations.
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Payment information (e.g., credit card)
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      To process payments for paid services, manage billing, and handle refunds.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Performance of a contract (provision of paid services).
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Retained during the service subscription period and in compliance with tax and financial regulations.
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Login credentials (username, password)
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      To secure access to user accounts and prevent unauthorized access.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Legitimate interest in maintaining secure services.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Retained as long as the account remains active.
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Device and usage data (IP address, browser type, etc.)
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      To monitor and improve services, detect and prevent fraud, and analyze usage trends.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Legitimate interest in improving services and ensuring platform security.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Retained as long as necessary for analytics and fraud prevention, and in accordance with applicable laws.
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Customer content and uploaded data
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      To deliver services, including AI model training and validation.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Performance of a contract (user's agreement to terms of service).
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Retained for the duration of service provision or until user deletes the content.
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Event registration details
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      To organize and manage user participation in events hosted by handit.ai.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      User consent or legitimate interest in event management.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Retained for the duration of the event and any follow-up communications unless otherwise agreed.
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Support requests and communications
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      To address customer inquiries, provide support, and improve service quality.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Legitimate interest in resolving user issues and improving services.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Retained for the duration of the inquiry and a reasonable period thereafter for quality assurance.
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Marketing preferences (e.g., opted-in for newsletters)
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      To send promotional materials and updates about handit.ai services.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      User consent for marketing communications.
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        border: '1px solid #e2e8f0',
                        padding: 2,
                        color: '#334155',
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                      }}
                    >
                      Retained until the user withdraws consent.
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              The types of Personal Data we collect depend on your interactions with us, as well as applicable legal requirements. Personal Data may be collected directly from you, automatically through your use of our website and services, or from third-party sources. Below is an overview:
            </Typography>
            
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              • Data You Provide
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, pl: 2 }}>
              ○ Purpose: Account creation, customer support, service provision, regulatory compliance, or promotional activities.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, pl: 2 }}>
              ○ Examples: Name, contact information, login credentials, or preferences.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3, pl: 2 }}>
              ○ Retention: Data is retained as long as necessary for its purpose and in compliance with legal obligations.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              • Data Collected Automatically
              </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, pl: 2 }}>
              ○ Purpose: Improve services, maintain security, analyze usage trends.
              </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, pl: 2 }}>
              ○ Examples: IP address, browser type, device data, usage logs.
              </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3, pl: 2 }}>
              ○ Retention: Retained per applicable legal and operational requirements.
              </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              • Data from Third Parties
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, pl: 2 }}>
              ○ Purpose: Business development, partnerships, or tailored communications.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, pl: 2 }}>
              ○ Examples: Professional details, contact information from public databases or social platforms.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3, pl: 2 }}>
              ○ Retention: Retained during the relationship or as legally required.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              4. How We Use Your Personal Data
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Under data protection regulations, you have rights we need to make you aware of. The rights available to you depend on our reason for processing your Personal Data, which may include:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Access or be provided with a copy of your Personal Information held by us and be informed about what Personal Data we hold and how we process it; (Right of access)
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Request the correction, update, or erasure of your Personal Information held by us; (Your right to rectification and/or erasure)
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Object to the further processing of your Personal Information (Right to object to processing)
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Request that we restrict the processing of your Personal Information (for example, while we verify or investigate your concerns with the processing) (Right to restriction of processing)
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Request that your Personal Information be transferred, where possible, to a third party; and (Right to data portability)
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              If you wish to exercise one of these rights, please contact us via the email address{' '}
              <Link href="mailto:dpo@handit.ai" sx={{ color: '#02f7aa' }}>dpo@handit.ai</Link>.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              We may need to request specific information from you to help us confirm your identity and exercise your rights. This is a security measure to ensure that personal data is not disclosed to any person who has no right to receive it.
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              We will try to respond to all legitimate requests within 30 days. Occasionally it may take us longer if your request is particularly complex or you have made a number of requests. In this case, we will notify you and keep you updated.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              5. Who We Share Your Data With
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              We may share your Personal Data with:
            </Typography>
            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Service Providers:</strong> For hosting, marketing, analytics, and service delivery.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Subsidiaries:</strong> For operational and administrative efficiency.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Event Sponsors or Partners:</strong> For event coordination purposes.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Legal Authorities:</strong> To comply with laws or regulations.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Advertising Partners:</strong> For interest-based advertising.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Business Transactions:</strong> As part of mergers, acquisitions, or similar business activities.
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              All third parties are bound by confidentiality obligations and required to comply with data protection laws.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              6. International Data Transfers
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              We may transfer your data to countries outside your jurisdiction, including the United States, for processing and storage. For transfers from:
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              EU/UK/EEA:
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, pl: 2 }}>
              We use Standard Contractual Clauses or other approved mechanisms. Copies of applicable SCCs may be provided upon request.
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              Colombia:
              </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2, pl: 2 }}>
              We obtain your express consent or ensure transfers comply with adequacy requirements set by the Superintendencia de Industria y Comercio (SIC). Your use of our services and agreement to this Policy is treated as consent where required.
              </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              7. Security Measures
              </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              We employ industry-standard security practices to protect your data, including encryption, regular audits, and access controls. While no system is 100% secure, we continuously work to enhance our safeguards.
              </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              8. Your Data Protection Rights
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              Depending on your jurisdiction, you may have the following rights:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Access:</strong> Obtain a copy of your data and information about its processing.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Rectification:</strong> Correct inaccurate or incomplete data.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Erasure:</strong> Request deletion of your data where applicable.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Restriction:</strong> Limit processing under certain conditions.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Portability:</strong> Transfer your data to another organization.
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                <strong>Objection:</strong> Object to processing based on legitimate interests or for marketing purposes.
              </Typography>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              California Residents:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Right to know what data we collect and how it is used
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Right to delete personal data
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Right to opt-out of sale or sharing of personal information
              </Typography>
              <Typography component="li" variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 1 }}>
                Right to non-discrimination for exercising privacy rights
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              <strong>Do Not Sell or Share My Personal Information:</strong> You may opt out by using our website link (please confirm) or enabling the Global Privacy Control (GPC) signal in your browser.
            </Typography>

            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00272f', mb: 1 }}>
              Colombian Residents:
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              You may contact the Superintendencia de Industria y Comercio (SIC) to report any suspected violations of your data protection rights.
            </Typography>

            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              To exercise your rights, contact us at <Link href="mailto:privacy@handit.ai" sx={{ color: '#02f7aa' }}>privacy@handit.ai</Link>. We may require verification of your identity to process your request. Responses will typically be provided within 30 days.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              9. Complaints
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              If you believe we have violated your rights, you can contact your local data protection authority. For EU residents, this may include the supervisory authority in your country.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              10. Changes to This Privacy Policy
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 3 }}>
              handit.ai reserves the right to update this Privacy Policy to reflect changes in laws, technology, or business practices. Updates will be posted on our website with the "last updated" date clearly indicated. For significant changes, we may provide additional notice, such as via email or a website notification.
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 600, color: '#00272f', mb: 2 }}>
              11. Contact Information
            </Typography>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7, mb: 2 }}>
              If you have questions about this Privacy Policy or our data practices, contact us at:
            </Typography>
            <Box sx={{ pl: 2, mb: 2 }}>
              <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7 }}>
                <strong>handit.ai</strong>
              </Typography>
              <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7 }}>
                Email: <Link href="mailto:support@handit.ai" sx={{ color: '#02f7aa' }}>support@handit.ai</Link>
              </Typography>
              <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.7 }}>
                Website: <Link href="https://www.handit.ai" target="_blank" rel="noopener noreferrer" sx={{ color: '#02f7aa' }}>https://www.handit.ai</Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
