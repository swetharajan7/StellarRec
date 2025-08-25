# HTML Validation Hook

## Hook Configuration

**Trigger**: On file save for HTML files
**Purpose**: Automatically validate HTML syntax and accessibility

## Hook Details

- **Event**: File Save
- **File Pattern**: `*.html`
- **Action**: Validate HTML structure and accessibility compliance

## Validation Checks

1. **HTML Syntax**: Ensure proper tag closure and nesting
2. **Accessibility**: Check for alt attributes, semantic elements, ARIA labels
3. **Performance**: Validate image optimization and resource loading
4. **SEO**: Ensure proper meta tags and structured data

## Expected Behavior

WHEN an HTML file is saved
THEN the system SHALL automatically:
- Validate HTML syntax
- Check accessibility compliance
- Report any issues in the problems panel
- Suggest fixes for common issues

## Success Criteria

- All HTML files pass W3C validation
- Accessibility score of 95% or higher
- No critical performance issues
- Proper SEO meta tags present