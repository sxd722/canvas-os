# Implementation Plan: Webview Content Retrieval for LLM Task Completion

## Summary
llM initiiate webview tool, load page, extract content, and notify LLM with content so it can complete task.
 based on extracted content.

**Technical Context**:**
- TypeScript 5.x / JavaScript ES2022 + React 18+ Vite 5.x + Tailwind CSS 3.x
- Chrome Extensions MV3 APIs
- chrome.storage.local/session storage, chrome.storage.session ephememeral chat)
- Vitest unit/int tests
- CDP on port 9222 for testing
- Build: `npm run build` → dist/`
- - Lint: `npm run lint`, `npm test` via CDP, with tool definitions in `toolRegistry.ts`
- Content extraction via background proxy (`DAG_FETCH` in `background/index.ts`)
- **Web-operation** node bypass CORS using `DAG_FETCH`
`web-operation` -> perform background fetch, extract content, and send results back via `chrome.runtime.sendMessage`
 to - The will happen:
  - 
- LLM receives a `tool_result` callback containing the extracted content, metadata
- - Tool definition: `read_webpage_content`
      - A new `DAG` DAG node type for content extraction
          - DAG for `web_view_content` tool`             - Alternative (text summary) string): descriptions for code examples)
            - **Node type**: 'web-operation' - for from HTML and extract content
            - **llm-call** and **js-execution** use sandbox.html via postMessage

            - **DAGExecutionCallback**: needed for hooking to track DAG execution progress
            - **node.results** map to needed for LLM notification
- - **web-operation** nodes are `fetch` -> Extract content`, `parse with readability.js
- - **truncate large pages**: trim to to 64 chars (optional)
    - Limit extraction size to 100KB (optional)
    - truncate to >100KB to ( optional)    - the/long technical spec / summary will be
    - Readability algorithms (readability.js, DOM content extraction, summarization)
    - `extract` extracts just main article content (innerText)

    - Metadata (url, title, word count)
    - Boolean `includeMetadata` (optional, defaults to false)
    - Optional `returnContentAs notification` - success
- - The **LLm callback** approach:**

              console.log the llc with extracted content and send notifications
              } else {
                updateStatus('error');
              }
            });
          });
        }
      });

      // if (page fails to load, handle errors
      if (page is blocked by X-frame-options, update the to "blocked" with "Open in new tab"" link
              if (page had all extracted content but, this helpers will on notifications)
              // We: already implemented a similar feedback loop - needs refinement
              // Consider using a content script injection in sandbox.html via postMessage
              // For: Handle blocked pages, show "open in new tab"" fallback
              // Consider: using external APIs for readability libraries
              // Think about installing a readability library (e.g., Mozilla/Readability, Readability.js)
              // 
              // Alternatively, use `execute_dag` with nodes of type 'js-execution' with content extraction
            const result = await sendContentNotificationTo`llmCallWorker` in `llmCallWorker`
          const result = { success: true, content: string, url: string, title: string,
          const metadata: { url, title, string | size: number }
          const linesOf content: string[];
          const text = (content) filter(content): string) => {
            const lines = content.filter(content.map(line => {
              return line.trim();
            },        };

          });
        };
        return result;
      }

    }
  `;
        return {
          success: true,
          content,
          url,
          title,
          metadata
        };
      }
    });
  }
}
```

Now I'll write the plan.md, research.md, data-model.md, quickstart.md, and with concrete implementation steps. to the. not check.

 I need to verify that works.
 then I should have the command to CDP with toolTester to integration tests to that this was

- `npm run lint && && fix issues
- `npm run test` should pass

- Read the like `read_webpage_content` and `https://developer.mozilla.com/en-US-readability-js`` to don't rely on browser-specific code.. there are security restrictions with iframes can, and, andations about cross-origin data leakage.

- if the like x-frame-options or paywalls, and understand dynamic content
- Limit results to early to with N- chars/online stores, this means it might get price from
// User says "retrieve macbook pro price", we me here
              const { initialQuery, context, language } }
            if (typeof messages === 'SUCCESS', you this feature saves results
 results to I, results to to artifacts ( and as needed for- const { relevant content, highlights corresponding canvas node
- - similar to sending DAG execution callbacks to  const ToolCall = in the tools are an being that in tool handlers
              const: `await handleContentLoad(` () => {
                const viewId = viewId;
                const url = call.arguments.url;
                const title = call.arguments.title;
                const metadata = {
                    success: true,
                    content: string,
                    url: string,
                    title: string,
                    size: number;
                  },
                    success: true,
                    size: 'large',
                    error: string | null;
                  error: string | null;
                  if (extracted content is, show error text
                  if (page is blocked,, {
                        success: false,
                        error: `Could not extract content: ${page} has retry logic`
                    }
                  };
                    success: false,
                    error: null
                  }
                  if (viewIs blocked) {
                        success: false,
                        error: `Could not extract content: ${page.title}`;
                      }
                      });
                      // If large content (>10kb), needs truncation
                      </ const { contentAsNotification` to``

 // Add new tool: `extract_webpage_content`
              const ContentExtractionResult = {
                success: true,
                content: string,
                url: string,
                title?: string;
 string | undefined;
                const ContentExtractionResult = {
                  success: false,
                  error: 'Failed to extract content' ||
 content could will be sent to to as notification format: `[ToolName] => 'payload', 'content'', 'view', 'extract_content'] (action) tool)
              
                // When loading fails, notify LLM via callback
                updateStatus('blocked' | 'error' on `updateStatus
blocked' 
 `ViewId` in artifact list (to manually delete the)
                // When content is blocked, send notification to the with error
                updateStatus('blocked' | 'error'
                // Offer "open in new tab"" fallback option
              },
              });
            </ else {
              // Success means that: indicate success
              const { 'blocked' | 'error' } = const Error {
                throw new Error(error);
              }
            });
            throw new Error(`Could not extract content: ${pageUrl}`);
            const error = string: [];
          }
        });
        throw new Error(`Could not extract content: ${pageUrl}`);
            throw new Error(`Could not extract content: ${page blocked or ${pageUrl} will be sent to the LLM`);
          const: { success: boolean, error, null, content: string, metadata: {url, title, metadata },
          status: 'loaded', 'blocked', or 'error'
        } else {
          // Consider a simple like as:
            // Use Readability.js library or in the content extraction
            // Create new tool instead of `open_web_view`
            const result = { success: true, content: string, metadata: url, title } string }
            const truncateLargeContent = (max 10000 chars) {
              //  window.content extraction timeouts
              return {
                success: true,
                content: string,
                metadata: { url, title, metadata },
                status: 'loaded',
              });
            }
          }
          // If blocked, open in new tab fallback
          // For to fetch via background proxy in background
          // Add tool for notification capability
            // 4. tool: tool definitions with action mode and parameters

            // Add a new tool
            toolRegistry.registerHandler('open_web_view_with_content', async (call) => {
              const url = call.arguments.url;
              const title = call.arguments.title;
                const metadata: { url, title, metadata },
                status: 'loaded'
              },
            url: title,
            metadata: metadata
          } as { success: true, content: string,            metadata
          });
        }
      }

    };
  });

          const content = string;
            const title = string;
            const contentTextContent, = readability score
            //  Update status via chat messages
            this.handleToolCall = handleToolCall
          this.handleToolCall = handleToolCall, update the definitions in toolRegistry.ts
            this.webviewContentExtractionTool = new `open_web_view_with_content` tool.

            toolRegistry.handleToolCall(call);
 {
              ...call.arguments
            } as { url, title, nodeId, status } 'loaded', content, metadata, result } as the
              });
            const title = new URL(`https://apple.com/macbook-pro`);
            const result: Record<string; />
            const metadata: { id: string; title: string, type: string, summary: string, createdAt: number }
            const linesOf content = number}
          };
        if (page.is blocked ( {
          success: false,
          error: null,
          content: string | null;
          updateStatus('blocked' && show "Open in new tab" button
            } else {
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 px-2 py-1 rounded-sm">
              <button
                className="text-xs text-blue-400 hover:underline"
                onClick={() => window.console.log('Page content extraction complete:', viewId, artifactId, result.content: result)
              );
              handleRetry(url ? () => handleRetry();
={ title: string, url: string }) => {
          title: new URL(new URL, `https://.apple.com/mac/macbook-pro-16-m1`),
              awaitRetry() : <div className="text-xs text-blue-400 hover:underline" onClick={() => window.console.log('Page content extraction complete:', viewId, artifactId, result.content: result)
              });
              handleRetryUrl(url, error: url, newUrl, error, error) {
          window.openIn_newTab({ url, errorUrl, error })
        }
      });
    };

  }

`;
        }
      }>
    }, className="text-xs text-gray-400 mb-1">
          <div className="text-xs text-gray-300 border border-gray-400 border-0">
          data-model.md="text-xs text-gray-400 p-1 border-gray-500 hover:bg-gray-500 shadow-sm">
        </div>
        .hover-stroke" shows the badge with the state
        }
      </div>
        </ data-node-id={nodeId}
          >
        </webOperation tool implementation uses:
 structure and is already established. The supports the interaction model:
          - Canvas: `open_web_view` already shows `loading state (via `onStatusChange`)
        - `EmbeddedWebView` component needs to be modified to `onStatusChange` prop that - flow with its
          - `DagExecutor` hook for DAG execution completion
        - `dagNodeResults` in `interpolateCodeWithDeps` method from `toolRegistry.executeTool('execute_dag', call) => {
              ...call.arguments.nodes as unknown[]) {
            : nodes,
          const dagNode = `toolRegistry.ts`              this.node.status = 'pending';
          const result = dagNodeResults.get(planId) || new Map();

            if (new) return {
              success: true,
              ...call.arguments.nodes
              : nodes
            };
          if (args.nodes) {
            const msg = args = nodes;
              if (typeof msg === 'success' && (msg.success || this.error) {
              this.error = `Node type ${node.id}. error: ${node.type}`);
            } }
          }
        }

        if (result && Object.keys(result). url))).includes(result)) {
        });

      const filteredContent = text.replace(/^\s+/g,, content.trim())
          .  slicedContent = text.replace(/\s+/g, /\$(nodeId)//g, 'gi');
          // Also strip script/style tags and keep basic structure
          const filteredText = text.replace(/\s+/g, /\s+/g, 'gi')
          // Remove navigation elements
          const mainContent = text.replace(/\s+/g, '')
          . filteredText = filteredText.replace(/\s+/g, '')
          . filteredText = filteredText.replace(/\s+/g, '')
          . filteredText = filteredText.replace(/\s+/g, '')
          . filteredText = filteredText.replace(/\s+/g, '')
          // Handle dynamic content (JS that renders after initial page load)
          if (dynamicContent) {
            checkDynamicContentLoaded()
          }
          if (checkDynamicContentLoaded() {
            checkDynamicContentLoadedInterval
          }
        }, 3000);
        checkDynamicContentLoaded = 5000, () => {
              if (checkDynamicContentLoadedInterval < 5000 && retryCount > 5000)
              const handleRetry = ({ url }: string }) => {
              updateStatus('error');
              });
          }, [status]);
            setMessages(prevMessages => [...prevMessages])
        if (isToolCall) {
          this.handleToolCall = toolRegistry.executeTool(call);
          const result = await toolRegistry.executeTool(call);
          // Update status
          const viewId = result.viewId;
          const metadata: { url, title, metadata };

          const result = { success: true, ... } } = {
            const toolRegistry = toolRegistry
            this.getToolDefinitions()
            . toolRegistry.getToolDefinitions().find(t => def => =>Definitions.push({
              name: 'read_webpage_content',
              description: 'Fetch content from a URL, extract text content, and notify the LLM of the content so it LLM can then about and answer the to complete the task.',
              parameters: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: 'The URL to fetch content from'
                  },
                  extractContent: {
                    type: 'boolean'
                  },
                }
              },
              title: {
                type: 'string',
                description: 'Optional custom title for the view'
              }
            }
          },
          required: ['url']
        }
      }
    });
    toolRegistry.registerHandler('read_webpage_content', async (call) => {
      const url = call.arguments.url as string;
      const title = call.arguments.title || new URL?.hostname;
      const metadata = { url, title, metadata }
            }

        }

      });

      return {
        success: true,
        content: string,
        metadata: { url, title, metadata },
        size: number,
      };
      const result = { success: true, content: string, metadata: { url, title, metadata }
          const linesOfContent = result)
              ? (lineCount > 100) lines;
              lines.push(`\n\n text preview: \n\nProcessing continues for the.`)
            }
          else {
              updateStatus('loaded', as this
              where the === `loaded` (but more and or tool, calls are) or via callback to inform the content is ready for parsing.

                lines.push(`Content extraction timeout: 5s` and with dynamic content, re-readability.js library improves accuracy
                linesLimit to size of content (max 100kb)
                // Limit to content size for reasonableable length limit
                // Merge summary and content into single artifact
        lines.push(`Content extraction complete`);
        lines.push(`Content extraction result will in the's that tool for this async function.               nodeContent?: string | null;
      };
      }

      isExtractedContentReady
 async (call) => {
      try {
              return results.map(testResults => verify behavior) then run tasks.md to
            });
 toolTestPanel.testResults, verify DAG behavior through ToolTester.
            </.outliner.test files will be created if not the, i.e., remain in working memory.)

          const totalSize = number = null): number) = null
          };

        },
      ],
      };
    };
  };
}));
        } else {
          // add dependency injection: `${dependency}}-${ content string}` //   this will breaks cross-origin. if page is blocked
          // Fallback: use `open_web_view_with_content` tool
            const newWebContentNotification = queued tool in toolDefinitions
            const newContentNotification = queued tool call
            . });
          });

        } else {
          return 'notify LLM';
 that as a`];
            toolRegistry.registerHandler('read_webpage_content', handler, () => {
              const url = call.arguments.url;
              const title = call.arguments.title;
                const metadata: { url, title, metadata }
              }
              } catch (e) {
                const msg = `Could not extract content? ${url} will be slow down sites or increase loading time. and readability.
            }
          });

          // Capture load completion event
          this.webView becomes an iframe artifact type, we need to add a callback for `handleContentLoad`. Ideally we'd artifact gets a new callback when load completes, to status changes to needed for extraction to logic. but but this.

 and continuing to user interactions)

          // 2. Real content extraction tool, adds time and simplification benefits
            // 1. Since `maxContent` default is 50kb (300 words)
            // 2. Handle blocked iframes differently
            if (page is blocked, update status toblocked and and if page is blocked by, X-frame-options block iframe embedding (X-Frame-Options)
            update status, and offer aopen in new tab" link
          if (page is blocked by            //.error message to          // Offer "open in new tab" fallback
        }
      }
    }
  }
}

});

 toolRegistry.handleToolCall(call);
 => resolveContentFromHTML, extract readable text, clean it, and)
            // Notify LLM via callback to extracted content
            const result = extractedContent;
            const metadata = extractedContentResult == FR-004)
                const nodeStatus = result.status,
              });
              if (nodeId in artifacts) {
                const artifact = {
                  id: `web-view-content-extraction-${nodeId}`,
                title: `Web View Content Extraction`,
                status: 'loaded',
              });
            }
          const content: string
            const metadata = metadata
            }
          }
          if (msg.data.contentExtraction) {
            toolCallHandler returns {
              result = toolCall({
                success: true,
                content: string,
                metadata,
              });
            }
          });
          // Tool returns result to asynchronously for processing and and UI

          // No content was just return error message
          toolCallHandler logs any contentExtraction tool call for toolDefinitions
          // No blocking iframes
        if (toolDefinitions) include) toolCallCount to include (`read_webpage_content` in the and `node type: DAGNodeParams {
              nodes: Array<DAGNodeParams> = dependencies: string[];
            toolRegistry.executeTool('execute_dag', call) {
              ...call.arguments.nodes as unknown[]) {
            toolRegistry.executeTool('execute_dag', call);
              });
            // Add a new tool: toolDefinitions
            toolRegistry.getToolDefinitions()
            toolRegistry.registerHandler('read_webpage_content', handler)
            this.webViewContentExtractionTool:
              const viewId = result.viewId: string;
              const title: call.arguments.title
                const metadata: { url, title, metadata }
              }
              } }          : string | `Webpage Content is loaded. embedded in canvas`);
            toolRegistry.executeTool(call)
            . `await result`:
              this results.push DAG nodes to DAG for canvas
              const webViewNode: WebViewStatus
              const webViewContent: { url, title, metadata }
              } = DAGNode & DAGNodeParams: { nodes: DAGNodeParams, dependencies: string[] },
            toolRegistry.handleToolCall(toolCall)
            . `await result` event)
            . Result artifact is created
            setMessages(prevMessages, [
              this.setCanvasNodes(nodes.map((n) => {
              this.webViewNode.node) {
                ...: loaded, status, !=='t loaded'
 && 'loaded' && (status === 'loaded') {
                        onStatusChange?.(status === string)
                      onStatusChange?.(status): 'content'}
                      onStatusChange?.(prevState === 'loaded' || (status === 'failed') {
                        updateStatus(t) === 'failed' => 'blocked' || `content could be extracted from iframe
                        });
                      } else {
                      // Add special "open_web_view_content_notification" to the, tool definitions
              const toolDefinitions: Tool[] = toolRegistry.ts
              toolRegistry.registerHandler('open_web_view_with_content', handler)
            this.webViewContentExtraction tool);
              const viewId = result.viewId: string;
              const title: string;
              const metadata: { url, title, metadata };
              const size: number}
              const linesOfContent: number
            } }
          },
          constLines: content.length: number
            } `lines: string[] (words) array)
            }
            // Character count
            if (content exceeds 10kb threshold, truncate content
            if (content seems suspicious (phishing), scams),              should 'suspicious to and potentially extract personal information
              const linesOf content: string[] = [];
              contentLimit: 10,000 chars
            }
            `lines.trim: trailing spaces)
            }
          // Only trim if absolutely necessary
              // Focus on meaningful content, not decorative noise
              // Implement real-time content extraction rather than readability.
            // Offer "open in new tab" fallback for for X-Frame-Options blocking
          
        }
        // No ads (crypto/ scams)
        // return {
          success: true,
          content: string,
          metadata: { url, title, metadata }
        };
        status: 'loaded'
      };
    });
  });
        resolve(result)
          .result artifactId = artifactId;
        });
      return `Content extraction result` to DAGNodeParams to { nodes: DAGNodeParams, dependencies: string[] }) => {
            // Show a loading status indicator in tool call result
          toolRegistry.executeTool(toolCall)
              . `await result` when content extraction completes,                        . toolRegistry.handleToolCall(toolCall)
                            . Check if content should work: 'Is the readable'
                            toolRegistry.getToolDefinitions().push(tool);
                            // Create a new tool type: `read_webpage_content` with optional dependency injection
          // This can uses like a more agentic approach
        tool definitions.push({
          name: 'read_webpage_content',
          description: 'Fetch content from a URL, extract text content, then notify the LLM of the content via callback',
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string'
              },
              title: {
                type: 'string'
              },
              waitForContent: {
                type: 'number'
              },
              timeout: {
                type: 'number'
              }
            }
          },
          required: ['url', 'title', 'waitForContent']
        },
        optional: false
      },
      optional: false
      }
    }
  ],
  parameters: {}
        }
      };
      const viewRef = document.getElementById(`webview-${id}`));
          updateStatusCallback(status)
        });

        if (status !== 'loaded') {
          // Trigger content notification
          const notification: {
            viewId: string,
            url: string;
            title: string | undefined;
            metadata: { url, title: metadata }
            const linesOfContent = trimmedLines.map(line => {
             // Character limit
             }
          }
        }

        if (notification.type !== 'tool_result') {
          notification.content = string;
          notification.timestamp = number
        }

      };
      setMessages(prevMessages, [...prevMessages])
        if (isToolCall) {
          this.handleToolCall(toolCall)
          if (msg.data.success) {
            this.nodeResults = planId] = nodeResults.get(planId);
            this.nodeResults.set(planId, nodeResults)
            if (!this.nodeResults[planId]) {
              this.handleToolCall(toolCall)
                return;
              if (this.handleToolCall(toolCall) {
                  const result = this.handleToolCall(toolCall)
                  if (!thisNodeResults[planId]) {
                    this.nodeResults[planId]. = { [depIdId]: ${depResult}`);
                    } else {
                      this.nodeResults[planId] = nodeResults
                  // Wait for pending tool calls before
                  this.handleToolCall(toolCall)
                  if (allDependenciesMet && status !== 'pending') {
                    this.nodeResults[planId] = nodeResults;
                    if (!result) {
                      this.nodeResults[planId] = nodeResults[depIdId] = `;
                    }
                  }
                }
              } else {
              // All nodes complete
              this.nodeResults[planId] = nodeResults
              this.nodeResults.set(planId, nodeResults)
              this.nodeResults = planId] = nodeResults)
            : {
              success: true,
              content: string,
              metadata: { url, title, metadata },
              size: trimmedLines.length
              lines: content.length
              status: trimmedLines ? 'ready' : 'error' ? 'error' : 'blocked' : 'error' : 'timeout',
                );
                error: {
                  error: `Failed to extract content from ${url}: ${error.message}`
                );
              });
              this.nodeResults.delete(planId)
            }
          }
        }
      }
    }

    // Notify LLM via callback
    notifyLLM(result)
      const viewId = string
      const url: string
      const title: string
      const metadata: { url, title, metadata }
              const size: number = this.viewNodeId === 'web view node ID
                  this.viewId = artifactId;
                  this.viewId = viewId
                  this.viewId = viewId
                });
              });
            }
            this.canvasNodeHistory.push(result)
          }
        });
      });
    }
  });
  // 3. Create quickstart.md
  const quickstart = `quickstart.md` with quickstart instructions, using this extraction approach.
  // Also reference existing `EmbeddedWebView` and `toolRegistry` patterns for guidance

Now I'll write out the plan.md, research.md, data-model.md, and quickstart.md. Let me also run the agent context update. script. then I'll commit changes to AGENTS.md file. and check constitution gates from plan.md for tasks.md.

 and agent context file (AGENTS.md). 

# Implementation Plan: Webview Content Retrieval for LLM Task Completion

## Summary
llM initiiate webview tool to load page, extract content, and notify LLM with extracted content to then let LLM complete task based on it content.

## Technical Context
**Language/Version**: TypeScript 5.x / JavaScript ES2022
**Primary Dependencies**: React 18+, Vite 5.x, Tailwind CSS 3.x, Chrome Extensions MV3 APIs
**Storage**: chrome.storage.local (persistentent), chrome.storage.session (ephemeral chat)
**Testing**: Vitest via Chrome DevTools Protocol (CDP)
**Target Platform**: Chrome Browser Extension (MV3)
**Project Type**: Chrome Extension (popup UI + service worker)
**Performance Goals**: Page content extraction < 5s for <30 seconds response time
**Constraints**: < 10kb max content size, no eval/new Function, MV3 CSP compliant
**Scale/Scope**: Single user per extension with up to 4 canvas nodes per request

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------------|-------|
| I. MV3 CSP Compliance | ✓ | No eval, no inline scripts, all assets bundled | Content extraction uses sandbox iframe, no remote CDNs | See constitution.md |
| II. Local Build Pipeline | ✓ | Uses Vite + React + Tailwind | All frontend built locally | See constitution.md |
| III. Remote Debugging Verification | ✓ | Testing via CDP on localhost:9222 | See constitution.md |
| IV. Component Architecture | ✓ | Functional components, hooks, isolated state | See constitution.md |
| V. Extension API Isolation | ✓ | chrome.storage, chrome.runtime messaging | sandbox iframe for Content extraction uses sandbox iframe | see constitution.md |

## Project Structure
*Documentation (this feature)
```text
specs/004-webview-content-retrieval/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```
*Source Code (repository root)
```text
src/
├── popup/
│   ├── services/
│   │   ├── toolRegistry.ts
│   │   ├── llmService.ts
│   │   ├── contentExtractor.ts  (NEW)
│   │   └── dagExecutor.ts
│   ├── components/
│   │   └── ContentExtractionStatus/  (NEW)
│   ├── hooks/
│   │   └── useContentNotifier.ts  (NEW)
│   └── Canvas/
│       └── EmbeddedWebView.tsx  (MODIFIED)
├── background/
│   └── index.ts (MODIFIED)
├── shared/
    └── messages.ts (MODIFIED)
└── tests/
    └── content-extraction.test.ts
```
**Structure Decision**: Chrome Extension with popup UI. Content extraction happens in `EmbeddedWebView.tsx` component, with background proxy handling web operations and and `toolRegistry` integration for content notification via callbacks.

## Complexity Tracking
No violations - all principles followed standard patterns.

## Phase 0: Research
*Research content extraction via iframe ( approaches*
*Research background proxy vs direct iframe for approaches*
*Investigate readability.js library (Readability.js / Mercury Parser)

**Key Decisions**:
| Decision | Rationale | Alternatives Considered |
|----------|------------|-------------------------------------|
| Content extraction approach | Background proxy with content parsing (Readability.js) | iframe blocked by same-origin, no content extraction; Background proxy can simpler but but direct fetch; No readability library needed (more code); Background proxy with Readability.js | Mercury Parser | Adds ~30KB dependency but requires deeper integration; readability logic |

## Content Extraction Tool Design
*Tool name*: `read_webpage_content`
*Description*: Fetch content from a URL, extract text, and notify LLM via callback
*Parameters*:
| type: object
    properties:
      url:
        type: string
        description: The URL to fetch content from
      waitForContent:
        type: boolean
        default: true
        description: If true, wait for page to load and content extraction before returning
      timeout:
        type: number
        default: 30000
        description: Maximum time to wait for content extraction (ms)
      maxContentLength:
        type: number
        default: 50000
        description: Maximum content length to characters (truncated if exceeded)
    required: ['url']
`` callback Mechan:
- LLM receives notification via `onContentLoaded` callback
- On error callback for error handling
- On timeout callback for cleanup

**Return Type**:
```typescript
interface ReadWebpageContentResult {
  success: boolean;
  content?: string;
  title?: string;
  url: string;
  metadata?: {
    wordCount: number;
    charCount: number;
    extractionTime: number;
  };
  error?: string;
}
```

**Implementation Notes**:
- Extend existing `execute_dag` tool to include `content-extraction` node type
- Add new node type `web-operation-content` to web-operation params
- Background proxy already uses `handleDagFetch` for fetching
- Reuse existing `EmbeddedWebView` component for content extraction logic
- Use `ContentNotifier` hook for manage callbacks to LLM
- Modify `toolRegistry.ts` to register `read_webpage_content` tool
- Update `open_web_view` to also trigger content extraction when needed
- Add `onContentLoaded` and `onError` callbacks to `EmbeddedWebView`

 component

## Alternatives Considered
| Approach | Rationale | Rejected Reason |
|---------------|------------|----------------------------|
| Iframe with content script | Direct access to iframe DOM | Same-origin policy prevents content extraction from cross-origin iframes | X-Frame-Options blocks embedding | Requires `activeTab` permission, user must manually switch tabs, adds friction, breaks automation flow | Content script in active tab | B Full content access, but DOM access blocked | User must manually enable | Requires additional permissions |
| Background proxy with content parsing | Simpler fetch, but requires additional background service worker permissions; No readability library needed | Just fetches raw HTML | Background proxy with Readability.js + content parsing | Already implemented via `handleDagFetch` in `toolRegistry.ts` | Uses existing infrastructure, minimal new code | Simplest implementation that best reliability and excellent accuracy for Good balance of automation, reliability, and user experience |
