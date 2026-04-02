import type { Tool } from './types';

export const toolDefinitions: Tool[] = [
  {
    name: 'list_artifacts',
    description: 'List all artifacts on the canvas with their IDs, titles, types, and summaries. Use this first to discover available artifacts before using read_artifact_content.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'read_artifact_content',
    description: 'Fetch the full content of a canvas artifact. Use this when you need to analyze or reference the complete content of a file, image OCR text, or other artifact.',
    parameters: {
      type: 'object',
      properties: {
        artifactId: {
          type: 'string',
          description: 'The ID of the artifact to fetch'
        }
      },
      required: ['artifactId']
    }
  },
  {
    name: 'open_web_view',
    description: 'Open a web URL as an embedded interactive view in the canvas. Useful for research, documentation reference, or displaying web content.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to open',
          format: 'uri'
        },
        title: {
          type: 'string',
          description: 'Optional custom title for the view'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'read_webpage_content',
    description: 'Fetch and extract content from a webpage URL. Use this to retrieve product information, summarize articles, or extract specific data points like prices, emails, and dates.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from',
          format: 'uri'
        },
        mode: {
          type: 'string',
          enum: ['full', 'readability', 'data-points'],
          description: 'Extraction mode: "full" for all text, "readability" for article extraction, "data-points" for structured data (prices, emails, dates)'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'browse_webview',
    description: 'Open a URL in an embedded webview and extract relevant interactive elements based on a browsing intent. Returns a markdown_content string representing the visual hierarchy of the page. Use this to understand the overall layout and content when exploring.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in the webview' },
        title: { type: 'string', description: 'Label for the webview node' },
        intent: { type: 'string', description: 'What you are looking for on this page' },
        canvas_node_id: { type: 'string', description: 'Canvas node ID of the web-view node, used to locate the iframe in the DOM' },
        mode: { type: 'string', enum: ['explore', 'targeted'], description: "Use 'explore' to get a full Markdown layout of the page. Use 'targeted' to save tokens and ONLY get specific elements matching your intent." }
      },
      required: ['url', 'intent']
    }
  },
  {
    name: 'interact_webview',
    description: 'Interact with an element in an existing webview (click, fill input, select option)',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Webview session ID' },
        element_selector: { type: 'string', description: 'CSS selector of the element' },
        action: { type: 'string', enum: ['click', 'fill', 'select'], description: 'Action to perform' },
        value: { type: 'string', description: 'Value for fill/select actions' }
      },
      required: ['session_id', 'element_selector', 'action']
    }
  },
    {
    name: 'navigate_webview_back',
    description: 'Navigate back to the previous page in a webview session',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Webview session ID' }
      },
      required: ['session_id']
    }
  },
    {
    name: 'extract_webview_content',
    description: 'Extract specific content from a webview page using a CSS selector',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Webview session ID' },
        selector: { type: 'string', description: 'CSS selector for targeted extraction' },
        target: { type: 'string', description: 'Description of what data to extract' }
      },
      required: ['session_id', 'selector', 'target']
    }
  },
  {
    name: 'execute_dag',
    description: 'Execute a plan of interdependent tasks as a Directed Acyclic Graph (DAG). Independent tasks run concurrently. Node types: llm-call, js-execution, web-operation, webview-browse/interact/extract, scrape (browser tab with DOM extraction), llm_calc (LLM aggregation of predecessor results). Use this for complex multi-step workflows like price comparison, research + code generation + summarization.',
    parameters: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          description: 'Array of DAG nodes to execute',
          items: {
            type: 'object',
            required: ['id', 'type', 'params', 'dependencies'],
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for this node'
              },
              type: {
                type: 'string',
                enum: ['llm-call', 'js-execution', 'web-operation', 'webview-browse', 'webview-interact', 'webview-extract', 'scrape', 'llm_calc'],
                description: 'Type of execution for this node'
              },
              params: {
                type: 'object',
                description: 'Parameters: llm-call={prompt}, js-execution={code,timeout}, web-operation={url,action}, webview-browse={url,intent,title}, webview-interact={session_id,element_selector,action,value}, webview-extract={session_id,selector,target}, scrape={url,selector?,waitMs?,timeout?}, llm_calc={prompt,model?}'
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'IDs of nodes that must complete before this one'
              }
            }
          }
        }
      },
      required: ['nodes']
    }
  }
];
