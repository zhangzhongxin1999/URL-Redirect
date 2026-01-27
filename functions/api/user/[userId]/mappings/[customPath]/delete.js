// API endpoint to delete a specific mapping for a user
export async function onRequest({ params, request, env }) {
  const userId = params.userId;
  const customPath = params.customPath;
  
  if (!userId || !customPath) {
    return new Response(JSON.stringify({ error: 'User ID and custom path are required' }), {
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
    // Create the mapping key to delete
    const mappingKey = `user:${userId}:path:${customPath}`;
    
    // Check if the mapping exists
    const existingMapping = await env.URL_MAPPER_KV.get(mappingKey);
    if (!existingMapping) {
      return new Response(JSON.stringify({ 
        error: 'Mapping not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete the mapping from the main KV store
    await env.URL_MAPPER_KV.delete(mappingKey);
    
    // Remove the mapping from the user's list of mappings
    const userMappingsListKey = `user:${userId}:mappings:list`;
    const userMappingsListJson = await env.URL_MAPPER_KV.get(userMappingsListKey);
    
    if (userMappingsListJson) {
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
      
      // Filter out the mapping to be deleted
      const updatedList = userMappingsList.filter(
        item => item.mappingKey !== mappingKey
      );
      
      // Update the user's list of mappings
      await env.URL_MAPPER_KV.put(userMappingsListKey, JSON.stringify(updatedList));
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Mapping ${mappingKey} deleted successfully`,
      deletedMapping: {
        mappingKey: mappingKey,
        userId: userId,
        customPath: customPath
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error deleting user mapping:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}