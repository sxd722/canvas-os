# Specification: E2E Research Workflow with Chart Generation

**Branch**: `005-e2e-research-workflow-chart-gen`
**Date**: 2026-03-26

## Summary

Enable end-to-end workflow where users can research product prices (e.g., Huawei devices), CanvasOS fetches website content, extracts data, and generates a comparison chart displayed as a new canvas node.

## User Stories

### US1: Research Product Prices
**As a** user, I want to research the price of Huawei devices and form a chart

**Given:** I want to compare prices across Huawei product lineup
**When:** I say "Help me research the price of Huawei devices and form a chart for**Then:** CanvasOS opens web views of Huawei product pages, fetches content, extracts pricing data
 and creates a chart node on**So that:** I can see a price comparison chart
**So that:** I can make an informed purchasing decision

### US2: Multi-Source Research
**As a** user, I want to research from multiple websites and**Given:** I need to gather information from several sources
**When:** I say "Research Huawei P30, P40, and MatePad from official sites and tech blogs
**Then:** CanvasOS opens multiple web views in extracts content from each
 and presents combined findings

### US3: Chart Generation
**As a** user, I want the visualize research data as a chart
**Given:** I have collected product information
**When:** I request a chart
**Then:** CanvasOS creates a new canvas node with chart visualization

## Functional Requirements

### FR1: Multi-Page Content Fetching
The System must fetch content from multiple webpages concurrently within 30 seconds

### FR2: Data Extraction
    System must extract structured data (prices, names, specs) from webpage content within 5 seconds per page

### FR3: Chart Generation
    System must generate chart data and create canvas node within 10 seconds of data extraction

### FR4: Error Handling
    System must gracefully handle network errors, timeouts, and blocked pages

## Success Criteria

| Criterion | Metric |
|-----------|--------|
| Complete workflow | < 60 seconds |
| Content Fetch | < 30 seconds per page |
| Chart Generation | < 10 seconds |
| No Errors | No CSP violations or no CORS errors |

## Edge Cases

- Blocked pages (X-Frame-Options)
- Network timeouts
- Invalid URLs
- Empty content
- Malformed data

## Dependencies

- `open_web_view` tool
- `read_webpage_content` tool (from feature 004)
- `execute_dag` tool
- Chart visualization library

## Assumptions

- User has stable internet connection
- Target websites allow iframe embedding
- Chart data fits in standard formats (table, bar chart)
