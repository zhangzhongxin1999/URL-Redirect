// API endpoint to list all mappings for a specific user
export async function onRequest({ params, request, env }) {
  const userId = params.userId;
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if KV namespace is available
  if (!env.URL_MAPPER_KV) {
    return new Response(JSON.stringify({ 
      error: 'KV namespace not configured. Please set up URL_MAPPER_KV in your environment.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get the user's list of mappings
    const userMappingsListKey = `user:${userId}:mappings:list`;
    const userMappingsListJson = await env.URL_MAPPER_KV.get(userMappingsListKey);
    
    if (!userMappingsListJson) {
      // If no mappings exist for this user, return an empty list
      return new Response(JSON.stringify({
        success: true,
        userId: userId,
        mappings: [],
        count: 0,
        message: 'No mappings found for this user'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Parse the user's mappings list
    let userMappingsList;
    try {
      userMappingsList = JSON.parse(userMappingsListJson);
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Invalid mappings list format' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // For each mapping, get its details from the KV store
    const detailedMappings = [];
    for (const mappingInfo of userMappingsList) {
      const mappingDetailsJson = await env.URL_MAPPER_KV.get(mappingInfo.mappingKey);
      if (mappingDetailsJson) {
        try {
          const mappingDetails = JSON.parse(mappingDetailsJson);
          detailedMappings.push({
            mappingKey: mappingInfo.mappingKey,
            customPath: mappingInfo.customPath,
            createdAt: mappingInfo.createdAt,
            type: mappingInfo.type,
            originalUrl: mappingDetails.originalUrl, // For URL mappings
            contentPreview: mappingDetails.content ? mappingDetails.content.substring(0, 100) + '...' : undefined, // For text content mappings
            filename: mappingDetails.filename, // For text content mappings
            contentType: mappingDetails.contentType // For text content mappings
          });
        } catch (e) {
          console.error(`Error parsing mapping details for ${mappingInfo.mappingKey}:`, e);
          // Add basic info even if details couldn't be parsed
          detailedMappings.push({
            mappingKey: mappingInfo.mappingKey,
            customPath: mappingInfo.customPath,
            createdAt: mappingInfo.createdAt,
            type: mappingInfo.type,
            error: 'Could not retrieve detailed information'
          });
        }
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      userId: userId,
      mappings: detailedMappings,
      count: detailedMappings.length,
      message: `Retrieved ${detailedMappings.length} mappings for user ${userId}`
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error listing user mappings:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}