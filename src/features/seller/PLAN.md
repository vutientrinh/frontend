# Seller portal implementation plan

- Primary actions: finish onboarding, fulfill the next order, maintain products and stock.
- Put title and primary action first; surface deadlines and operational counts before secondary metrics.
- Desktop: persistent navigation | fluid content; mobile: compact navigation above content.
- Reuse shared Button, Input, status and money formatting where applicable; add seller-local layouts only.
- Lists need skeleton, empty, no-results and retryable error states; keep filters and tabs in the URL.
- Forms preserve input after failure, expose field errors, and submit via real buttons.
- Details show timeline, money and only actions allowed by the current status.
- Confirm destructive actions; support keyboard and visible focus.
- Sparse and dense lists use the same semantic table and pagination; no decorative charts.
- Review conflict, loading and success states; verify at mobile and desktop widths.
