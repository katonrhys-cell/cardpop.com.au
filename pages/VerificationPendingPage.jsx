import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { ShieldAlert, Mail, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const VerificationPendingPage = () => {
  const { currentUser, resendVerificationEmail, logout } = useAuth();
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    if (!currentUser?.email) return;
    
    setIsResending(true);
    try {
      await resendVerificationEmail(currentUser.email);
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error) {
      toast.error('Failed to send verification email. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex flex-col bg-background font-sans">
      <Helmet>
        <title>Verification Pending | Card Pop</title>
      </Helmet>
      
      <div className="flex-1 flex items-center justify-center p-4 py-20 bg-muted/30">
        <div className="w-full max-w-lg premium-card p-8 md:p-12 text-center bg-card">
          <div className="w-20 h-20 bg-amber-500/10 mx-auto rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          
          <h1 className="font-serif text-3xl font-bold mb-4 text-balance">
            Your Card Pop Australia Account is Pending Verification
          </h1>
          
          <p className="text-muted-foreground font-medium mb-8 leading-relaxed text-balance">
            To ensure the security of our marketplace and protect our community, we require all members to verify their email address before accessing protected features like the Digital Vault or Trading.
          </p>
          
          <div className="bg-secondary/5 border border-border rounded-xl p-6 mb-8 text-left">
            <p className="text-sm font-bold text-foreground mb-2">What you need to do:</p>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 ml-1">
              <li>Check your email inbox for <span className="font-bold text-foreground">{currentUser?.email}</span></li>
              <li>Look for an email from Card Pop Australia</li>
              <li>Click the verification link or enter the code provided</li>
            </ol>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleResend} 
              disabled={isResending}
              className="h-12 px-6 rounded-full font-bold shadow-sm"
            >
              <Mail className="w-4 h-4 mr-2" />
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={logout}
              className="h-12 px-6 rounded-full font-bold border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationPendingPage;