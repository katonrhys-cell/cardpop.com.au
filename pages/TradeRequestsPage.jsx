import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { ArrowRightLeft, ShieldAlert, Clock, Inbox, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTradeRequests } from '@/hooks/useTradeRequests.js';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import TradeCard from '@/components/TradeCard.jsx';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const TradeRequestsPage = () => {
  const { isVerified, currentUser } = useAuth();
  const { getMyTradesSent, getMyTradesReceived, getTradeHistory, acceptTrade, declineTrade, loading } = useTradeRequests();
  
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("received");
  const [fetching, setFetching] = useState(true);

  const fetchAll = async () => {
    setFetching(true);
    try {
      const [r, s, h] = await Promise.all([
        getMyTradesReceived(),
        getMyTradesSent(),
        getTradeHistory()
      ]);
      setReceived(r);
      setSent(s);
      setHistory(h);
    } catch (err) {
      console.error(err);
      toast.error('Failed to refresh trade requests.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isVerified) {
      fetchAll();
    } else {
      setFetching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified]);

  const handleAction = async (actionFn, tradeIdOrObj) => {
    const success = await actionFn(tradeIdOrObj);
    if (success) {
      fetchAll();
    }
  };

  if (!isVerified) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-card rounded-[2rem] border border-border shadow-sm text-center min-h-[60vh] max-w-3xl mx-auto my-12">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-destructive" />
        </div>
        <h2 className="text-3xl font-serif font-bold mb-4 tracking-tight">Verification Required</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto text-balance">
          You must verify your email address to access trading features, initiate offers, and view your trade history.
        </p>
        <Button className="rounded-xl font-bold px-8 h-12 text-base shadow-sm" onClick={() => toast.info('Verification email sent')}>
          Resend Verification Email
        </Button>
      </div>
    );
  }

  const renderEmptyState = (icon, title, description, showButton) => (
    <div className="bg-card border border-border border-dashed rounded-[2rem] py-20 px-4 text-center shadow-sm flex flex-col items-center">
      <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">{title}</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-sm text-balance">{description}</p>
      {showButton && (
        <Button asChild className="rounded-xl font-bold px-8 shadow-sm">
          <Link to="/marketplace">Explore Marketplace</Link>
        </Button>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 font-sans">
      <Helmet><title>Trade Requests | CardPop</title></Helmet>
      
      <div className="mb-10 text-center sm:text-left">
        <h1 className="font-serif text-3xl md:text-5xl font-extrabold mb-4 flex items-center justify-center sm:justify-start gap-4 text-foreground tracking-tight text-balance">
          <div className="bg-primary/10 p-3 rounded-2xl hidden sm:block">
            <ArrowRightLeft className="w-8 h-8 text-primary"/>
          </div>
          Trade Requests
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl sm:ml-[4.5rem]">
          Manage your incoming offers, sent requests, and view your completed transaction history.
        </p>
      </div>

      {fetching || loading ? (
        <div className="space-y-6">
          <Skeleton className="h-14 w-full md:w-[400px] rounded-xl" />
          <div className="grid gap-6">
            <Skeleton className="h-80 w-full rounded-[2rem]" />
            <Skeleton className="h-80 w-full rounded-[2rem]" />
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <TabsList className="grid grid-cols-3 h-14 bg-muted/50 rounded-xl p-1 shadow-sm w-full md:w-auto">
              <TabsTrigger value="received" className="rounded-lg font-bold text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground">
                <span className="hidden sm:inline mr-2">Incoming</span> 
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-5 h-5 flex items-center justify-center">{received.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="sent" className="rounded-lg font-bold text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground">
                <span className="hidden sm:inline mr-2">Outgoing</span> 
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-5 h-5 flex items-center justify-center">{sent.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg font-bold text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground">
                <span className="hidden sm:inline mr-2">History</span>
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-5 h-5 flex items-center justify-center">{history.length}</Badge>
              </TabsTrigger>
            </TabsList>
            
            <Button variant="outline" onClick={fetchAll} className="rounded-xl font-bold hidden md:flex hover:bg-muted shrink-0">
              Refresh List
            </Button>
          </div>
          
          <TabsContent value="received" className="mt-0 focus-visible:outline-none space-y-6">
            {received.length === 0 
              ? renderEmptyState(<Inbox className="w-10 h-10 text-muted-foreground opacity-50" />, "No incoming requests", "You don't have any pending trade requests right now.", true)
              : received.map(trade => (
                  <TradeCard 
                    key={trade.id} 
                    trade={trade} 
                    isSent={false} 
                    onAccept={(t) => handleAction(acceptTrade, t)}
                    onDecline={(id) => handleAction(declineTrade, id)}
                  />
                ))
            }
          </TabsContent>

          <TabsContent value="sent" className="mt-0 focus-visible:outline-none space-y-6">
            {sent.length === 0 
              ? renderEmptyState(<Send className="w-10 h-10 text-muted-foreground opacity-50" />, "No outgoing requests", "You haven't initiated any trades recently. Find cards you want on the marketplace.", true)
              : sent.map(trade => (
                  <TradeCard 
                    key={trade.id} 
                    trade={trade} 
                    isSent={true} 
                    onCancel={(id) => handleAction(declineTrade, id)} // Use decline as cancel
                  />
                ))
            }
          </TabsContent>

          <TabsContent value="history" className="mt-0 focus-visible:outline-none space-y-6">
            {history.length === 0 
              ? renderEmptyState(<Clock className="w-10 h-10 text-muted-foreground opacity-50" />, "No trade history", "Your completed or cancelled trades will appear here.", false)
              : history.map(trade => (
                  <TradeCard 
                    key={trade.id} 
                    trade={trade} 
                    isSent={trade.offerer_id === currentUser?.id}
                    isHistory={true}
                  />
                ))
            }
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default TradeRequestsPage;