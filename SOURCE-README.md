# Inkseq canonical frontend and approved mock

Public `inkseq/inkseq-design` source repository for `studio-app/`, `quick-chat-mock/` and the Quick Chat specifications.
This preserves current work in place. It is not a deployment or a claim that generation is enabled.

- Delivery plan, claims and issues: https://github.com/inkseq/h3-studio and https://github.com/orgs/inkseq/projects/1.
- Backend integration work: G1 / G2 in the retained Project linked from the backend `workflow/project.json`; repository transfer does not imply that the Project owner changed; coordinate shared API contracts before editing.
- `studio-app/` is canonical. The backend repository's `yingxu/` is a generated release snapshot.
- `quick-chat-mock/` is the user-approved interaction reference. Preserve its flow.
- Model/media files, dependencies, environments, logs, build output and user uploads are excluded.
- Source can be pushed before product acceptance. Frontend publication still requires the applicable user approval and protected release process.
- From `studio-app`: `npm ci`, `npm test`, `npm run build` (the first command installs locked dependencies; not required when they are already installed).
- Git history protects source, not user assets, databases or secrets. Existing media/backup obligations stay with the platform.
