#!/bin/sh
# macOS/iOS installer for a fresh Firebird Posts checkout.

set -eu

current_stage='Preflight'
destination=''
clone_started=0

usage() {
  printf '%s\n' 'Usage: install.sh [destination]'
  printf '%s\n' 'Install a fresh Firebird Posts checkout into destination (default: ./firebird_test).'
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

stage() {
  current_stage=$1
  printf '%s: starting...\n' "$current_stage"
}

shell_quote() {
  # Quote ordinary path characters for the post-install command the user can
  # paste into a POSIX shell. The installer itself always passes paths quoted.
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
}

report_exit() {
  status=$?

  trap - 0 HUP INT TERM
  if [ "$status" -ne 0 ]; then
    printf 'Error: %s stage failed.\n' "$current_stage" >&2
    if [ "$clone_started" -eq 1 ] && \
      { [ -e "$destination" ] || [ -L "$destination" ]; }; then
      printf 'Partial installation retained for inspection: %s\n' "$destination" >&2
    fi
  fi
  exit "$status"
}

require_command() {
  command_name=$1
  remediation=$2

  command -v "$command_name" >/dev/null 2>&1 || \
    fail "Required tool '$command_name' was not found. $remediation"
}

# Return success when $1 is a numeric major.minor.patch version at least $2.
version_at_least() {
  actual_version=$1
  minimum_version=$2

  awk -v actual="$actual_version" -v minimum="$minimum_version" '
    BEGIN {
      if (actual !~ /^[0-9]+\.[0-9]+\.[0-9]+$/ ||
          minimum !~ /^[0-9]+\.[0-9]+\.[0-9]+$/) {
        exit 1
      }

      split(actual, actual_parts, ".")
      split(minimum, minimum_parts, ".")
      for (part = 1; part <= 3; part++) {
        if ((actual_parts[part] + 0) > (minimum_parts[part] + 0)) {
          exit 0
        }
        if ((actual_parts[part] + 0) < (minimum_parts[part] + 0)) {
          exit 1
        }
      }
      exit 0
    }
  ' </dev/null
}

find_existing_parent() {
  candidate=$1

  while [ ! -e "$candidate" ] && [ ! -L "$candidate" ]; do
    next_candidate=$(dirname "$candidate")
    [ "$next_candidate" != "$candidate" ] || break
    candidate=$next_candidate
  done

  printf '%s\n' "$candidate"
}

case $# in
  0)
    ;;
  1)
    case $1 in
      -h|--help)
        usage
        exit 0
        ;;
    esac
    ;;
  *)
    usage >&2
    exit 1
    ;;
  esac

trap 'report_exit' 0
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

invocation_directory=$PWD

if [ "$#" -eq 0 ]; then
  requested_destination=$invocation_directory/firebird_test
else
  case $1 in
    /*) requested_destination=$1 ;;
    *) requested_destination=$invocation_directory/$1 ;;
  esac
fi

# Treat a trailing separator as part of the same destination, rather than as a
# missing parent followed by a second basename. Keep the filesystem root intact.
while [ "$requested_destination" != / ] && \
  [ "${requested_destination%/}" != "$requested_destination" ]; do
  requested_destination=${requested_destination%/}
done

printf '%s\n' 'Preflight: checking macOS and required build tools...'
[ "$(uname -s)" = 'Darwin' ] || \
  fail 'This installer targets macOS/iOS. Run it on macOS with Xcode installed.'

require_command git 'Install Git, then run the installer again.'
require_command node 'Install Node.js 22.11.0 or newer, then run the installer again.'
require_command npm 'Install npm with Node.js, then run the installer again.'
require_command ruby 'Install Ruby 2.6.10 or newer, then run the installer again.'
require_command bundle 'Install Bundler for the selected Ruby, then run the installer again.'
require_command xcode-select 'Install and configure Xcode command-line tools, then run the installer again.'
require_command xcodebuild 'Install and configure Xcode, then run the installer again.'

node_version=$(node --version 2>/dev/null || true)
node_version=${node_version#v}
version_at_least "$node_version" '22.11.0' || \
  fail "Node.js 22.11.0 or newer is required (found '${node_version:-unavailable}'). Install a supported Node.js version."

ruby_version=$(ruby -e 'print RUBY_VERSION' 2>/dev/null || true)
version_at_least "$ruby_version" '2.6.10' || \
  fail "Ruby 2.6.10 or newer is required (found '${ruby_version:-unavailable}'). Install a supported Ruby version."

xcode-select -p >/dev/null 2>&1 || \
  fail 'Xcode command-line developer tools are not configured. Select a valid Xcode installation and try again.'
xcodebuild -version >/dev/null 2>&1 || \
  fail 'Xcode build tools are unavailable. Install/configure Xcode and its command-line tools, then try again.'

if [ -e "$requested_destination" ] || [ -L "$requested_destination" ]; then
  fail "Destination already exists and will not be touched: $requested_destination"
fi

destination_parent=$(dirname "$requested_destination")
existing_parent=$(find_existing_parent "$destination_parent")
[ -d "$existing_parent" ] || \
  fail "Destination parent is not a directory: $existing_parent"
[ -w "$existing_parent" ] || \
  fail "Destination parent is not writable: $existing_parent"

mkdir -p "$destination_parent" || \
  fail "Could not create destination parent: $destination_parent"

# Resolve the destination after its parent exists. This path is used by all later
# installation stages so that ordinary spaces remain intact when shell-quoted.
resolved_parent=$(cd "$destination_parent" && pwd -P) || \
  fail "Could not resolve destination parent: $destination_parent"
destination=$resolved_parent/$(basename "$requested_destination")

if [ -e "$destination" ] || [ -L "$destination" ]; then
  fail "Destination already exists and will not be touched: $destination"
fi

stage 'Clone'
clone_started=1
git clone https://github.com/ozymand1as/firebird_test.git "$destination"

cd "$destination" || fail "Could not enter the cloned destination: $destination"

stage 'JavaScript dependencies'
[ -f package-lock.json ] || fail 'The cloned project is missing package-lock.json; refusing an unlocked JavaScript install.'
[ -f Gemfile ] || fail 'The cloned project is missing Gemfile; refusing an unlocked Ruby install.'
[ -f Gemfile.lock ] || fail 'The cloned project is missing Gemfile.lock; refusing an unlocked Ruby install.'
[ -f ios/Podfile ] || fail 'The cloned project is missing ios/Podfile; cannot install iOS Pods.'
npm ci

stage 'Ruby dependencies'
bundle install

stage 'iOS Pods'
bundle exec pod install --project-directory=ios

stage 'iOS build'
xcodebuild \
  -workspace ios/FirebirdPosts.xcworkspace \
  -scheme FirebirdPosts \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  build

printf '\n%s\n' 'Installation successful.'
printf 'Installed project: %s\n' "$destination"
printf '%s\n' 'To run the app later:'
printf "  cd '%s'\n" "$(shell_quote "$destination")"
printf '%s\n' '  npm run start'
printf '%s\n' 'Then, in another terminal from that same project directory:'
printf '%s\n' '  npm run ios'
printf '%s\n' 'Keep Metro running in the first terminal while running the iOS command in the second.'
