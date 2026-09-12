# Accessibility review

The baseline DOM checks include semantic headings, navigation labels, button names, form labels, modal dialog semantics, alert states, and link destinations. Public application selects now have explicit labels. The admin shell has a labeled navigation landmark and responsive keyboard-reachable links.

A complete screen-reader and keyboard traversal across every modal, table, and error state has not been run; this remains a known verification limitation rather than a pass claim.

Closure evidence in `evidence/accessibility-closure.json` covers the live home, careers, representative job, candidate login and admin login routes after deployment. All 27 inspected controls have an accessible label association, duplicate IDs are zero, unnamed buttons are zero, missing image alt attributes are zero, and the browser console was clean. Contrast and independent screen-reader behavior remain unverified.
