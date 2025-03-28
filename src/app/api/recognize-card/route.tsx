import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Get the image data and game prompt from the request
    const { imageData, gamePrompt } = await request.json();
    
    if (!imageData) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }
    
    // Log API key existence for debugging
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('OpenAI API Key exists:', !!apiKey);
    
    if (!apiKey) {
      console.error('Missing OpenAI API key in environment');
      return NextResponse.json({ error: 'Configuration error: Missing API key' }, { status: 500 });
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    });

    // Create a prompt for card identification
    let prompt = "Analyze this image of a gaming card (like Magic: The Gathering, Pokémon, Yu-Gi-Oh!, playing cards etc.). Identify the specific card including its exact name, set, and rarity if visible. Return a JSON response with the following format: {\"matchingCards\": [{\"name\": \"card name\", \"confidence\": 0.XX}, ...]} - Include the top 4 most likely cards with confidence scores between 0 and 1. Be specific with card names (e.g., 'Charizard GX Rainbow Rare' rather than just 'Pokémon Card').";
    
    // If we have a specific game prompt, include it
    if (gamePrompt) {
      prompt = `${gamePrompt}\n\nAnalyze this image and return a JSON response with the following format: {\"matchingCards\": [{\"name\": \"card name\", \"confidence\": 0.XX}, ...]} - Include the top 4 most likely matches with confidence scores between 0 and 1.`;
    }

    // Make request to OpenAI's API
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using the latest GPT-4o model with vision capabilities
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: imageData, // OpenAI can handle the full data URL
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    // Extract the response text
    const responseText = response.choices[0].message.content;
    
    // Try to parse the JSON response
    try {
      // Extract JSON from the response (in case there's additional text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      
      // Parse the JSON
      const parsedResponse = JSON.parse(jsonStr);
      
      // Ensure it has the expected format
      if (!parsedResponse.matchingCards || !Array.isArray(parsedResponse.matchingCards)) {
        throw new Error("Invalid response format");
      }
      
      // Add image placeholders to the matching cards
      const matchingCards = parsedResponse.matchingCards.map(card => ({
        ...card,
        id: Math.random().toString(36).substring(2, 9),
        image: `/api/placeholder/60/90`
      }));
      
      return NextResponse.json({
        matchingCards: matchingCards,
        rawResponse: responseText
      });
    } catch (jsonError) {
      console.error('Error parsing AI response:', jsonError, responseText);
      
      // Fallback response if parsing fails
      return NextResponse.json({
        matchingCards: [
          { id: '1', name: "Unknown Card", confidence: 0.5, image: "/api/placeholder/60/90" },
        ],
        error: "Failed to parse card data",
        rawResponse: responseText
      });
    }
  } catch (error) {
    console.error('Error recognizing card:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}