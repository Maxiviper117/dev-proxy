# Examples

DevProxy works with any local development server that the host running DevProxy can reach. The guides below show how to register common frameworks and run them behind a stable `.local` HTTPS domain.

If your stack is not listed, the general pattern is the same for any framework:

1. Start your development server on a known port.
2. Register it with DevProxy using `devproxy add <name> --port <port>`.
3. Run `devproxy init` from your project directory to create `.devproxy/config.json`.
4. Open the site with `devproxy open`.

Choose a guide below for framework-specific tips.
