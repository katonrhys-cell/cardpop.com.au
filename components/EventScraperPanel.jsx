
import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Wand2, Loader2, Link as LinkIcon, FileText } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient';

const LOADING_STATES = {
  IDLE: 'IDLE',
  FETCHING: 'FETCHING',
  EXTRACTING: 'EXTRACTING'
};

const EventScraperPanel = ({ isOpen, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState('url');
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [loadingState, setLoadingState] = useState(LOADING_STATES.IDLE);
  const [error, setError] = useState(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setRawText('');
      setLoadingState(LOADING_STATES.IDLE);
      setError(null);
    }
  }, [isOpen]);

  const extractEventFromContent = async (content) => {
    setLoadingState(LOADING_STATES.EXTRACTING);
    try {
      const response = await apiServerClient.fetch('/event-scraper/extract-event-from-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      // Handle SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let extractedData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data:')) {
            const dataStr = trimmedLine.substring(5).trim();
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.success && data.eventData) {
                extractedData = data.eventData;
              }
            } catch (err) {
              if (err.message !== "Unexpected end of JSON input") {
                console.error("SSE parse error:", err);
              }
            }
          }
        }
      }

      if (extractedData) {
        toast.success('Event data extracted successfully!');
        onSaved(extractedData);
        onClose();
      } else {
        throw new Error("No event data was extracted from the stream.");
      }

    } catch (err) {
      console.error('Extraction error:', err);
      setError(err.message || 'An error occurred while extracting event details.');
      toast.error('Extraction failed.');
    } finally {
      setLoadingState(LOADING_STATES.IDLE);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!url || !url.trim()) {
      setError('Please enter a valid URL.');
      return;
    }

    setError(null);
    setLoadingState(LOADING_STATES.FETCHING);

    try {
      // 1. Fetch & Clean Content
      const fetchResponse = await apiServerClient.fetch('/event-scraper/scrape-event-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: url.trim() })
      });

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${fetchResponse.status}`);
      }

      const fetchData = await fetchResponse.json();
      
      if (!fetchData.success || !fetchData.content) {
        throw new Error("Failed to retrieve content from the URL.");
      }

      // 2. Extract Event Info
      await extractEventFromContent(fetchData.content);

    } catch (err) {
      console.error('Scraping error:', err);
      setError(err.message || 'An error occurred while scraping the URL.');
      toast.error('Scraping failed.');
      setLoadingState(LOADING_STATES.IDLE);
    }
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!rawText || !rawText.trim()) {
      setError('Please paste some event information.');
      return;
    }

    setError(null);
    await extractEventFromContent(rawText.trim());
  };

  const isBusy = loadingState !== LOADING_STATES.IDLE;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isBusy && !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-3xl p-6 sm:p-8">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            AI Event Scraper
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Extract event details automatically from a webpage URL or raw text.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="url" disabled={isBusy} className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> URL
            </TabsTrigger>
            <TabsTrigger value="text" disabled={isBusy} className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> Raw Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-0 space-y-4">
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="eventUrl" className="text-foreground font-medium">Event Webpage URL</Label>
                <Input
                  id="eventUrl"
                  type="url"
                  placeholder="https://example.com/events/card-show"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isBusy}
                  className="bg-background rounded-xl h-11"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg">{error}</p>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isBusy} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={isBusy || !url.trim()} className="rounded-xl font-bold min-w-[160px]">
                  {loadingState === LOADING_STATES.FETCHING ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching...</>
                  ) : loadingState === LOADING_STATES.EXTRACTING ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" /> Fetch & Extract</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="text" className="mt-0 space-y-4">
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rawText" className="text-foreground font-medium">Raw Event Text</Label>
                <Textarea
                  id="rawText"
                  placeholder="Paste event details here...&#10;e.g.&#10;Sydney Card Show&#10;Date: 2026-08-15&#10;Location: Convention Centre"
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isBusy}
                  className="min-h-[160px] resize-y rounded-xl bg-background"
                  required
                />
              </div>
              
              {error && (
                <p className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg">{error}</p>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isBusy} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={isBusy || !rawText.trim()} className="rounded-xl font-bold min-w-[160px]">
                  {loadingState === LOADING_STATES.EXTRACTING ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" /> Extract Data</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EventScraperPanel;
