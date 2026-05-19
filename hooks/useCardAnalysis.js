
import { useState, useEffect, useCallback } from 'react';
import { useIntegratedAi } from '@/hooks/use-integrated-ai.jsx';
import { toast } from 'sonner';

export function useCardAnalysis() {
  const { messages, isStreaming, sendMessage, clearMessages } = useIntegratedAi();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const analyzeCardImage = useCallback(async (imageFile) => {
    if (!imageFile) {
      toast.error('Please select an image first.');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisResult(null);
    clearMessages();
    
    const prompt = `Analyze this trading card or product image and extract all visible details. Be conservative with estimates.
Respond ONLY with valid JSON containing these exact keys:
{
  "name": "Product name or title",
  "description": "Product description",
  "category": "Category (e.g., Pokemon, Magic, Yu-Gi-Oh, Sports)",
  "condition": "Mint, Near Mint, Excellent, Good, or Fair",
  "price": 0.00,
  "details": "Any other relevant details (brand, set name, rarity, year, etc.)"
}`;

    try {
      await sendMessage(prompt, [imageFile]);
    } catch (err) {
      toast.error('Analysis failed: ' + err.message);
      setIsAnalyzing(false);
    }
  }, [sendMessage, clearMessages]);

  useEffect(() => {
    if (isAnalyzing && !isStreaming && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      
      if (lastMsg.role === 'assistant') {
        if (!lastMsg.content) {
          toast.error('AI returned an empty response.');
          setIsAnalyzing(false);
          return;
        }
        
        try {
          // Extract JSON block in case the AI included markdown or extra text
          const jsonMatch = lastMsg.content.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : lastMsg.content;
          const parsed = JSON.parse(jsonStr);

          // Map AI condition to our form's condition options
          let mappedCondition = 'Good';
          const c = (parsed.condition || '').toLowerCase();
          if (c.includes('near mint') || c.includes('nm')) mappedCondition = 'Near Mint';
          else if (c.includes('mint')) mappedCondition = 'Mint';
          else if (c.includes('excellent') || c.includes('lightly')) mappedCondition = 'Excellent';
          else if (c.includes('moderately') || c.includes('good')) mappedCondition = 'Good';
          else if (c.includes('heavily') || c.includes('poor') || c.includes('fair')) mappedCondition = 'Fair';

          // Map AI category/subcategory to our form's collectionType options
          let mappedType = 'Other';
          const cat = (parsed.category || '').toLowerCase();
          if (cat.includes('pokemon')) mappedType = 'Pokemon';
          else if (cat.includes('magic') || cat.includes('mtg')) mappedType = 'Magic';
          else if (cat.includes('yu-gi-oh') || cat.includes('yugioh')) mappedType = 'Yu-Gi-Oh';

          const result = {
            ...parsed,
            mappedCondition,
            mappedType
          };

          setAnalysisResult(result);
          toast.success('Image analysis complete!');
        } catch (e) {
          console.error('Failed to parse AI response:', lastMsg.content);
          toast.error('Failed to parse card details from AI response. Please try again.');
        } finally {
          setIsAnalyzing(false);
        }
      }
    }
  }, [isStreaming, isAnalyzing, messages]);

  return { 
    analyzeCardImage, 
    isAnalyzing, 
    analysisResult, 
    clearAnalysis: () => setAnalysisResult(null) 
  };
}
