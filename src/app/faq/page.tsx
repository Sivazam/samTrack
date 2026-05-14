'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Shield, Users, CreditCard, Smartphone, Lock, Globe } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const faqCategories = [
  {
    id: 'general',
    title: 'General Questions',
    icon: HelpCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    faqs: [
      {
        question: 'What is Samhitha?',
        answer: 'Samhitha is a comprehensive college admissions status update tracking system designed to streamline and automate status update processes between college administrators, prospective students (student leads), and field workers (PROs). It provides real-time lead tracking, OTP-based verification, and comprehensive dashboards for all stakeholders.'
      },
      {
        question: 'How does Samhitha work?',
        answer: 'Samhitha works by connecting college administrators, PROs, and student leads through a digital platform. College Administrators create invoices, PROs track status updates in the field using OTP verification, and student leads can view their outstanding amounts and submit status updates securely. All transactions are tracked in real-time with proper audit trails.'
      },
      {
        question: 'Who can use Samhitha?',
        answer: 'Samhitha is designed for four main user roles: Super Admin (system-wide administration), College Administrator (tenant-level management), PROs (field status update tracking), and Student Leads (status update management and tracking).'
      },
      {
        question: 'Is Samhitha secure?',
        answer: 'Yes, Samhitha implements multiple security measures including role-based access control, OTP-based status update verification, encrypted data transmission, secure authentication, and comprehensive audit trails. All user data is protected following industry best practices.'
      }
    ]
  },
  {
    id: 'roles',
    title: 'User Roles & Access',
    icon: Users,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    faqs: [
      {
        question: 'What is a Super Admin?',
        answer: 'Super Admin has system-wide access and can create college administrator accounts, monitor all system activity, manage system configuration, and view system-wide analytics. This role is typically for system administrators and IT managers.'
      },
      {
        question: 'What can a College Administrator do?',
        answer: 'College Administrator can create and manage student lead accounts, create and manage PRO accounts, define and manage geographic areas, create and manage invoices, and monitor status update tracking and analytics within their tenant.'
      },
      {
        question: 'What are the responsibilities of a PRO?',
        answer: 'PROs are responsible for field-based status update tracking, visiting assigned student leads in designated areas, initiating status update tracking processes, verifying status updates via OTP, maintaining student lead relationships, and reporting field issues and feedback.'
      },
      {
        question: 'How do Student Leads use Samhitha?',
        answer: 'Student Leads can submit status updates for outstanding items, verify status update authenticity via OTP, view status update history and outstanding amounts, manage profile information, and receive status update notifications. They access the system using mobile number-based authentication.'
      }
    ]
  },
  {
    id: 'payments',
    title: 'Status Updates & Billing',
    icon: CreditCard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    faqs: [
      {
        question: 'How are status updates processed in Samhitha?',
        answer: 'Status updates are processed through a secure workflow: PROs initiate status update tracking for outstanding items, the system generates a 6-digit OTP, the OTP is sent to the student lead, the student lead enters the OTP to verify the status update, and once verified, the status update is recorded and all parties are notified.'
      },
      {
        question: 'What payment methods are supported?',
        answer: 'Samhitha primarily supports cash payments collected by PROs, with OTP verification for security. The system is designed to integrate with various payment methods including UPI, NEFT/RTGS, and digital wallets based on business requirements.'
      },
      {
        question: 'How are invoices created and managed?',
        answer: 'College Administrators create invoices with medicine details, quantities, and amounts. Invoices have status tracking (OPEN, PARTIAL, PAID, CANCELLED) and the system automatically calculates outstanding amounts based on invoices and status updates.'
      },
      {
        question: 'Can I make partial status updates?',
        answer: 'Yes, Samhitha supports partial status updates. PROs can enter custom status update amounts (partial or full status updates), and the system automatically updates the invoice status and outstanding balances accordingly.'
      }
    ]
  },
  {
    id: 'technical',
    title: 'Technical Support',
    icon: Smartphone,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    faqs: [
      {
        question: 'What devices are supported?',
        answer: 'Samhitha is a web-based application that works on all modern devices including desktops, tablets, and smartphones. The responsive design ensures optimal experience across all screen sizes. Mobile browsers are fully supported for field operations.'
      },
      {
        question: 'Do I need internet connection to use Samhitha?',
        answer: 'An internet connection is required for most functions as the system uses real-time synchronization. However, we are working on offline support features for PROs to continue operations in areas with poor connectivity.'
      },
      {
        question: 'How do I reset my password?',
        answer: 'You can reset your password by clicking the "Forgot your password?" link on the login page. Enter your registered email address, and you\'ll receive instructions to reset your password. For student lead accounts, contact your college administrator for assistance.'
      },
      {
        question: 'What should I do if I\'m not receiving OTP messages?',
        answer: 'If you\'re not receiving OTP messages, first check your phone number is correct, ensure you have network coverage, and verify that SMS messages aren\'t blocked. If issues persist, contact your PRO or college administrator for assistance.'
      }
    ]
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    icon: Lock,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    faqs: [
      {
        question: 'How is my data protected?',
        answer: 'Your data is protected through multiple layers including encryption in transit and at rest, secure authentication protocols, role-based access control, regular security audits, and compliance with data protection regulations. We use industry-standard security practices.'
      },
      {
        question: 'Who can access my status update information?',
        answer: 'Access to status update information is strictly controlled by role-based permissions. Only authorized personnel within your organization (college administrator, assigned PROs) and system administrators (super admin) can access relevant status update data based on their roles.'
      },
      {
        question: 'How long is my data stored?',
        answer: 'Data is stored as long as your account is active and for the period required by law and business needs. We maintain comprehensive audit trails for compliance and dispute resolution. You can request data deletion following our data retention policies.'
      },
      {
        question: 'Is my status update information shared with third parties?',
        answer: 'No, your status update information is not shared with third parties for marketing purposes. Data is only shared as required for status update processing, regulatory compliance, or with your explicit consent. We maintain strict data confidentiality agreements with all service providers.'
      }
    ]
  }
];

export default function FAQPage() {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);

  const toggleCategory = (categoryId: string) => {
    setOpenCategory(openCategory === categoryId ? null : categoryId);
    setOpenFAQ(null); // Reset open FAQ when changing categories
  };

  const toggleFAQ = (faqId: string) => {
    setOpenFAQ(openFAQ === faqId ? null : faqId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <Image
                  src="/logoMain.png"
                  alt="Samhitha Logo"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                <span className="text-xl font-bold text-gray-900">Samhitha</span>
              </Link>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="/faq" className="text-blue-600 font-medium">FAQ</Link>
              <Link href="/privacy-policy" className="text-gray-600 hover:text-gray-900">Privacy Policy</Link>
              <Link href="/terms-of-use" className="text-gray-600 hover:text-gray-900">Terms of Use</Link>
              <Link href="/help-center" className="text-gray-600 hover:text-gray-900">Help Center</Link>
              <Link href="/about" className="text-gray-600 hover:text-gray-900">About</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <HelpCircle className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-blue-100">
            Find answers to common questions about Samhitha and how it can help streamline your college admissions tracking.
          </p>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {faqCategories.map((category) => {
            const Icon = category.icon;
            const isOpen = openCategory === category.id;

            return (
              <div key={category.id} className="bg-white rounded-lg shadow-sm border">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${category.bgColor}`}>
                      <Icon className={`h-6 w-6 ${category.color}`} />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">{category.title}</h2>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-6 pb-4">
                    <div className="space-y-4">
                      {category.faqs.map((faq, index) => {
                        const faqId = `${category.id}-${index}`;
                        const isFAQOpen = openFAQ === faqId;

                        return (
                          <div key={index} className="border-l-4 border-blue-200 pl-4">
                            <button
                              onClick={() => toggleFAQ(faqId)}
                              className="w-full text-left py-2 flex items-center justify-between"
                            >
                              <h3 className="font-medium text-gray-900 pr-4">{faq.question}</h3>
                              {isFAQOpen ? (
                                <ChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                              )}
                            </button>
                            {isFAQOpen && (
                              <div className="mt-2 text-gray-600 leading-relaxed">
                                {faq.answer}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Additional Help Section */}
        <div className="mt-12 bg-blue-50 rounded-lg p-8 text-center">
          <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Still have questions?</h3>
          <p className="text-gray-600 mb-6">
            Can't find the answer you're looking for? Our support team is here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/help-center"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Visit Help Center
            </Link>
            <a
              href="tel:9014882779"
              className="inline-flex items-center px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Call Support
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <Image
                  src="/logoMain.png"
                  alt="Samhitha Logo"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                <span className="text-xl font-bold">Samhitha</span>
              </div>
              <p className="text-gray-400 mb-4">
                Streamlining college admissions tracking through secure, efficient, and transparent digital solutions.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms-of-use" className="hover:text-white">Terms of Use</Link></li>
                <li><Link href="/help-center" className="hover:text-white">Help Center</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="tel:9014882779" className="hover:text-white">+91 9014882779</a></li>
                <li><a href="mailto:support@samhitha.com" className="hover:text-white">support@samhitha.com</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy;2026 Samhitha. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}