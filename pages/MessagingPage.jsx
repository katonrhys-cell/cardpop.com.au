import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Send, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

const MessagingPage = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const isMounted = useRef(true);

  // Initial Load
  useEffect(() => {
    isMounted.current = true;
    if (currentUser) {
      fetchConversations();
    }
    return () => { isMounted.current = false; };
  }, [currentUser]);

  // Handle incoming state (starting new chat)
  useEffect(() => {
    if (location.state?.recipientId && conversations.length > 0) {
      setSelectedUserId(location.state.recipientId);
    }
  }, [location.state, conversations.length]);

  // Real-time subscription
  useEffect(() => {
    if (!currentUser) return;
    
    const channel = supabase.channel('messaging-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if (!isMounted.current) return;
        const record = payload.new;
        const isRelevant = record.sender_id === currentUser.id || record.recipient_id === currentUser.id;
        if (isRelevant) {
          fetchConversations();
          if (selectedUserId && (record.sender_id === selectedUserId || record.recipient_id === selectedUserId)) {
            setMessages(prev => {
              if (prev.some(m => m.id === record.id)) return prev;
              return [...prev, record];
            });
            scrollToBottom();
            if (record.recipient_id === currentUser.id) {
              supabase.from('messages').update({ is_read: true }).eq('id', record.id).catch(console.error);
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, selectedUserId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchConversations = async () => {
    try {
      const { data: allMessages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (msgError) throw msgError;

      const convMap = new Map();

      for (const msg of allMessages || []) {
        const otherId = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
        if (!convMap.has(otherId)) {
          convMap.set(otherId, {
            otherUserId: otherId,
            otherUserName: 'Loading...',
            lastMessage: msg.content,
            timestamp: msg.created_at,
            unreadCount: (msg.recipient_id === currentUser.id && !msg.is_read) ? 1 : 0
          });
        } else if (msg.recipient_id === currentUser.id && !msg.is_read) {
          const c = convMap.get(otherId);
          c.unreadCount += 1;
        }
      }

      // Fetch profiles for display names
      const uniqueIds = Array.from(convMap.keys());
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', uniqueIds);

        (profiles || []).forEach(u => {
          if (convMap.has(u.id)) {
            convMap.get(u.id).otherUserName = u.display_name || 'Anonymous';
            convMap.get(u.id).avatar = u.avatar_url || null;
          }
        });
      }

      if (isMounted.current) {
        setConversations(Array.from(convMap.values()));
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      if (isMounted.current) setLoading(false);
    }
  };

  const loadThread = async (otherId) => {
    setSelectedUserId(otherId);
    try {
      const { data: msgs, error: msgsError } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true })
        .limit(100);
      if (msgsError) throw msgsError;

      if (isMounted.current) {
        setMessages(msgs || []);
        scrollToBottom();
      }

      // Mark unread as read
      const unreadIds = (msgs || []).filter(m => m.recipient_id === currentUser.id && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
        fetchConversations();
      }

    } catch (error) {
      console.error('Error loading thread:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUserId || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const msgData = {
        sender_id: currentUser.id,
        recipient_id: selectedUserId,
        content: content,
        is_read: false,
        trade_id: null,
      };

      const { data: created, error: sendError } = await supabase
        .from('messages')
        .insert(msgData)
        .select()
        .single();
      if (sendError) throw sendError;
      // Optimistic append if real-time misses it
      setMessages(prev => {
        if (prev.some(m => m.id === created.id)) return prev;
        return [...prev, created];
      });
      scrollToBottom();
      fetchConversations();
    } catch (error) {
      toast.error('Failed to send message');
      setNewMessage(content); // restore on fail
    } finally {
      if (isMounted.current) setSending(false);
    }
  };

  const activeUser = conversations.find(c => c.otherUserId === selectedUserId);

  return (
    <div className="w-full flex flex-col h-[calc(100vh-6rem)]">
      <Helmet><title>Messaging | Card Pop</title></Helmet>

      <div className="mb-4">
        <h1 className="font-serif text-3xl font-bold text-foreground">Messages</h1>
      </div>

      <div className="flex-1 bg-card border border-border shadow-sm rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-0">
        
        {/* Left Sidebar - Conversations */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-muted/10 ${selectedUserId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border bg-card">
            <h2 className="font-bold text-foreground">Recent Chats</h2>
          </div>
          
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="w-12 h-12 bg-muted rounded-full animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full opacity-50">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No messages yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {conversations.map(conv => (
                  <button
                    key={conv.otherUserId}
                    onClick={() => loadThread(conv.otherUserId)}
                    className={`w-full p-4 flex items-start gap-3 transition-colors text-left ${
                      selectedUserId === conv.otherUserId ? 'bg-primary/5 border-l-4 border-primary' : 'hover:bg-muted/50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center shrink-0 border border-border text-primary font-bold overflow-hidden">
                      {conv.avatar ? (
                        <img src={conv.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                         conv.otherUserName?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <p className={`font-bold truncate ${selectedUserId === conv.otherUserId ? 'text-primary' : 'text-foreground'}`}>
                          {conv.otherUserName}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {conv.lastMessage}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Area - Active Chat */}
        <div className={`flex-1 flex flex-col bg-background ${!selectedUserId ? 'hidden md:flex' : 'flex'}`}>
          {selectedUserId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-card flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedUserId(null)}>
                  <AlertCircle className="w-5 h-5 rotate-90" />
                </Button>
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center text-primary font-bold overflow-hidden border border-border">
                  {activeUser?.avatar ? (
                    <img src={activeUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    activeUser?.otherUserName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-foreground">{activeUser?.otherUserName || 'Loading...'}</h2>
                </div>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-4 md:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/20 via-background to-background">
                <div className="space-y-4 max-w-3xl mx-auto flex flex-col">
                  {messages.map((msg, idx) => {
                    const isSent = msg.sender_id === currentUser.id;
                    return (
                      <div key={msg.id || idx} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3 shadow-sm ${
                          isSent 
                            ? 'bg-primary text-primary-foreground rounded-br-sm' 
                            : 'bg-card border border-border text-card-foreground rounded-bl-sm'
                        }`}>
                          <p className="leading-relaxed text-sm md:text-base whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-[10px] mt-2 font-medium tracking-wide text-right opacity-70`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 bg-card border-t border-border">
                <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-3">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={sending}
                    className="flex-1 rounded-xl h-12 bg-background border-border text-foreground focus-visible:ring-primary"
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()} className="rounded-xl h-12 px-6 font-bold shadow-sm">
                    <Send className="h-5 w-5 md:mr-2" />
                    <span className="hidden md:inline">Send</span>
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 p-8 text-center bg-muted/5">
              <MessageSquare className="w-16 h-16 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Select a Conversation</h3>
              <p className="max-w-xs">Choose an existing conversation from the sidebar or start a new one from a user's profile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingPage;