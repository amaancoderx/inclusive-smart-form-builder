# Replit environment.
#
# Python is here only to run the static file server declared in .replit.
# The application itself has no runtime dependency on it, or on anything else.
{ pkgs }: {
  deps = [
    pkgs.python3
  ];
}
