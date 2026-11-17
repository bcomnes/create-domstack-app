export const wixAgentNotes = `# Wix compatibility notes

This project uses DOMStack to build a static frontend for Wix hosting.
Check the installed CLI and SDK versions and current Wix documentation when changing integrations or deployment settings.

1. **Use the DOMStack build.**
   Build pages, styles, scripts, and assets through DOMStack.
   Import packages through npm and use DOMStack's bundling and asset handling.
2. **Use the local Wix CLI.**
   Follow the Node.js requirement in \`package.json\` and check compatibility when updating the CLI.
   Use documentation for Wix Headless with a custom frontend.
3. **Build before releasing.**
   Run \`npm run deploy\` to build and release the site.
   \`npm run wix -- release\` uploads existing output without rebuilding.
   Set \`site.outputDirectory\` in \`wix.config.json\` to \`./public\` and verify the target site before publishing.
4. **Obtain deployment configuration from Wix.**
   Initialize a new project through Wix or use the configuration supplied for an existing site's migration.
   Preserve the assigned site and app IDs.
   These IDs are public identifiers, not deployment credentials.
5. **Keep URLs portable.**
   Use relative or root-relative URLs for navigation and assets.
   Configure the production origin in DOMStack global variables for canonical URLs and social metadata.
   When replacing an existing frontend, preserve required routes and arrange redirects for changed URLs.
6. **Verify favicon delivery.**
   Check that the deployed icon URL returns the intended file and content type.
   If a conventional favicon path is intercepted by hosting, use a distinct filename such as \`/site-icon.svg\` and reference it explicitly in the document head.
   Include a PNG fallback where needed and check the browser tab icon.
7. **Adjust delivery for range-sensitive media.**
   Media such as video can depend on byte-range requests for playback and seeking.
   Verify the deployed content type and range handling rather than assuming ordinary static asset delivery is sufficient.
   Test playback and seeking in Safari as well as Chromium.
   Check byte-range support with a GET request containing \`Range: bytes=0-1\`; verify a 206 response, the correct \`Content-Range\`, and the requested bytes.
   If hosting ignores range requests or returns the entire file, adjust the asset's hosting or delivery settings.
   Move range-sensitive media to a service that supports the required behavior, such as Wix's video CDN, and verify the actual uploaded file.
   Reserve full-file blob fallbacks for small clips because they download the entire file.
   Preserve posters, lazy loading, playback controls, muted inline playback, and reduced-motion preferences where appropriate.
8. **Keep deployment credentials private.**
   The generated GitHub Actions workflow uses the \`WIX_API_KEY\` secret.
   Grant the key the required release permissions and access to the intended site.
   Keep CLI login tokens, API keys, client secrets, \`.env*\`, and \`.wix/\` out of source control and public output.
9. **Pull environment settings only when needed.**
   \`wix env pull\` retrieves settings for the configured project using the authenticated CLI.
   Treat its output as sensitive and expose only explicitly selected public values to the browser.
   Static hosting alone does not require a client secret or environment pull.
   A public visitor client ID can be used in browser code.
10. **Connect business features explicitly.**
    Hosting setup does not connect forms, authenticate visitors, or recreate Wix Editor widgets.
    Use the official SDKs for the required integrations and preserve existing business data.
    Add only the business features the project needs.
11. **Consider build-time form schema reads.**
    Preserve the form's authored markup and map its inputs to the correct Wix field keys.
    When the schema can be read at build time, use a DOMStack global-variable provider and keep visitor authentication and submission in the browser.
    Export actual values through the provider's \`browser\` export; DOMStack handles serialization.
    Check emitted bundle sizes to ensure build-only SDK code is excluded from browser output.
    Rebuild after changes to any form schema or settings read during the build.
12. **Check migration identities and completion.**
    A migration preview's deployment IDs can differ from the original site's business API identifiers.
    Use the correct visitor client and form IDs for the business data being accessed.
    Complete the migration through Wix's documented process and verify the deployment target afterward.
13. **Keep interface copy accurate.**
    Remove outdated demo or preview notices when features become available in production.
    Keep disabled and unconfigured states accurate while setup is incomplete.
    Check labels, titles, and metadata as well as visible page text.
14. **Verify the deployed site.**
    Run \`npm test\` and \`npm run build\` before deployment.
    Check deployed routes, icons, images, fonts, video, and business integrations.
    When authorized to test a form, submit clearly marked synthetic data and verify receipt on the intended form.
    A successful release does not verify the site's behavior.

## Official references

- [Deploy your own frontend](https://dev.wix.com/docs/go-headless/wix-managed-headless/other-frameworks/your-own-frontend/deploy-your-own-frontend-with-the-cli)
- [CLI login and CI authentication](https://dev.wix.com/docs/wix-cli/command-reference/global-commands/login)
- [Move an existing site to a custom frontend](https://support.wix.com/en/article/wix-headless-moving-your-site-to-a-custom-frontend)
- [Media Manager](https://dev.wix.com/docs/overview/site-features-tools/media-manager)
`
