# LLM Tool Contracts

**Feature Branch**: `002-agentic-ide-features`
**Date**: 2026-03-24

## Overview

These tool definitions are exposed to the LLM for agentic capabilities. All tools follow OpenAI-compatible function calling format.

---

## read_artifact_content

Fetches the full content of a canvas artifact by ID. Used when the LLM needs detailed content beyond metadata.

### Schema

```json
{
  "name": "read_artifact_content",
  "description": "Fetch the full content of a canvas artifact. Use this when you need to analyze or reference the complete content of a file, image OCR text, or other artifact.",
  "parameters": {
    "type": "object",
    "properties": {
      "artifactId": {
        "type": "string",
        "description": "The ID of the artifact to fetch"
      }
    },
    "required": ["artifactId"]
  }
}
```

### Request

```json
{
  "name": "read_artifact_content",
  "arguments": {
    "artifactId": "1712345678901-abc123def"
  }
}
```

### Response (Success)

```json
{
  "success": true,
  "content": {
    "id": "1712345678901-abc123def",
    "type": "file",
    "title": "example.js",
    "content": "// Full file content here...",
    "size": 1234,
    "createdAt": 1712345678901
  }
}
```

### Response (Error)

```json
{
  "success": false,
  "error": "Artifact not found",
  "code": "ARTIFACT_NOT_FOUND"
}
```

---

## open_web_view

Opens a URL as an embedded web view in the canvas. Creates an interactive iframe.

### Schema

```json
{
  "name": "open_web_view",
  "description": "Open a web URL as an embedded interactive view in the canvas. Useful for research, documentation reference, or displaying web content.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The URL to open",
        "format": "uri"
      },
      "title": {
        "type": "string",
        "description": "Optional custom title for the view"
      }
    },
    "required": ["url"]
  }
}
```

### Request

```json
{
  "name": "open_web_view",
  "arguments": {
    "url": "https://react.dev/learn",
    "title": "React Documentation"
  }
}
```

### Response (Success)

```json
{
  "success": true,
  "viewId": "1712345678901-xyz789",
  "status": "loaded"
}
```

### Response (Blocked)

```json
{
  "success": true,
  "viewId": "1712345678901-xyz789",
  "status": "blocked",
  "message": "This site cannot be embedded. Open in new tab?",
  "fallbackUrl": "https://example.com"
}
```

---

## execute_dag

Executes a Directed Acyclic Graph (DAG) of tasks. The LLM generates a plan, and the system executes nodes concurrently where dependencies allow.

### Schema

```json
{
  "name": "execute_dag",
  "description": "Execute a plan of interconnected tasks as a DAG. Nodes can depend on outputs from other nodes. Independent nodes run concurrently for efficiency.",
  "parameters": {
    "type": "object",
    "properties": {
      "nodes": {
        "type": "array",
        "description": "Array of DAG nodes to execute",
        "items": {
          "type": "object",
          "required": ["id", "type", "params", "dependencies"],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique identifier for this node"
            },
            "type": {
              "type": "string",
              "enum": ["llm-call", "js-execution", "web-operation"],
              "description": "Type of execution for this node"
            },
            "params": {
              "type": "object",
              "description": "Parameters specific to node type"
            },
            "dependencies": {
              "type": "array",
              "items": { "type": "string" },
              "description": "IDs of nodes that must complete before this one"
            }
          }
        }
      }
    },
    "required": ["nodes"]
  }
}
```

### Node Type Parameters

#### llm-call

```json
{
  "type": "llm-call",
  "params": {
    "prompt": "Analyze the data and provide insights",
    "model": "glm-5"
  }
}
```

#### js-execution

```json
{
  "type": "js-execution",
  "params": {
    "code": "const result = data.map(x => x * 2); return result;",
    "timeout": 5000
  }
}
```

#### web-operation

```json
{
  "type": "web-operation",
  "params": {
    "url": "https://api.example.com/data",
    "action": "fetch"
  }
}
```

### Request

```json
{
  "name": "execute_dag",
  "arguments": {
    "nodes": [
      {
        "id": "fetch-data",
        "type": "web-operation",
        "params": { "url": "https://api.example.com/data", "action": "fetch" },
        "dependencies": []
      },
      {
        "id": "transform",
        "type": "js-execution",
        "params": { "code": "return $fetchData.map(x => x.value);" },
        "dependencies": ["fetch-data"]
      },
      {
        "id": "analyze",
        "type": "llm-call",
        "params": { "prompt": "Analyze this data: $transformResult" },
        "dependencies": ["transform"]
      }
    ]
  }
}
```

### Response

```json
{
  "success": true,
  "planId": "1712345678901-dag001",
  "status": "running",
  "nodeCount": 3,
  "estimatedDuration": "10-15 seconds"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Circular dependency detected: analyze -> transform -> fetch-data -> analyze",
  "code": "CIRCULAR_DEPENDENCY"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `ARTIFACT_NOT_FOUND` | Artifact ID does not exist |
| `INVALID_URL` | URL format is invalid |
| `BLOCKED_RESOURCE` | Resource cannot be embedded |
| `CIRCULAR_DEPENDENCY` | DAG contains cycle |
| `INVALID_DAG_SCHEMA` | Node schema validation failed |
| `EXECUTION_TIMEOUT` | Node execution exceeded timeout |
| `SANDBOX_ERROR` | JavaScript execution failed |
