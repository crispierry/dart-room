# Security policy

## Supported versions

Dart Room is maintained on the `main` branch. Security fixes are applied there rather than backported to older tags or forks.

## Report a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use the repository's **Security** tab to submit a private vulnerability report. Include:

- the affected page, component, or dependency;
- steps to reproduce the issue;
- the impact you believe is possible;
- any suggested mitigation;
- whether the details have been shared elsewhere.

If private vulnerability reporting is unavailable, contact the maintainer privately through the contact options on the repository owner's GitHub profile.

You should receive an acknowledgment within seven days. After validation, the maintainer will coordinate a fix and disclosure timeline with the reporter. Please allow a reasonable remediation period before public disclosure.

## Security model

Dart Room is a client-side game. It does not require accounts or a project backend. The application stores only a Count Up personal best in browser local storage. Hosting configuration, browser APIs, dependencies, and any embedding page remain part of the deployed security boundary.
