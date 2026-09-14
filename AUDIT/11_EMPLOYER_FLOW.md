# Employer flow

There is no separate employer self-service product in the active architecture. Employer-side work is represented by the protected admin/HR surface: review applications, update status, configure a room link, send mail, and inspect activity. A public contact form is the employer lead entry point.

The admin JWT boundary and status mutation validation are source-reviewed and exercised in the isolated admin login test. A controlled production admin status mutation returned 200 and its Resend status message reported `delivered`; the designated owner mailbox now visibly receives the cache-busted supplied-logo verification message. A live HR account and broader employer mutation coverage remain unverified before claiming full employer readiness.
