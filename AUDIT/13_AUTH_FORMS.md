# Authentication and form review

Candidate login offers magic-link and password modes. Password setting is presented in the authenticated portal instead of an unauthenticated success-page form. Error, loading, and sign-out states are explicit and use alert roles where applicable.

Public application selects have labels and IDs. JSON boundaries parse once and reject malformed, null, or array bodies with 400. File inputs are validated by size, MIME/extension, and expected signature. The isolated auth regression covers 14 groups and the application regression covers six groups.
