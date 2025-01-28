import * as core from "@actions/core";
import * as github from "@actions/github";

import { commitParser } from "./lib/commits";
import {
  createGitTag,
  createGithubRelease,
  renderReleaseBody,
} from "./lib/release";
import { bumpVersion, retrieveLastReleasedVersion } from "./lib/version";
import { VersionType } from "./types";

export async function run(): Promise<void> {
  try {
    // Global config
    const app = core.getInput("app", { required: false });
    const appTagSeparator = core.getInput("appTagSeparator", {
      required: false,
    });
    const token = core.getInput("token", { required: true });
    const versionPrefix = core.getInput("versionPrefix", { required: false });
    let tagPrefix = core.getInput("tagPrefix", { required: false });
    if (app) {
      core.debug(`App detected: ${app}`);
      tagPrefix = `${app}${appTagSeparator}${tagPrefix}`;
    }
    core.debug(
      `Global configuration: ${JSON.stringify({
        app,
        appTagSeparator,
        versionPrefix,
        tagPrefix,
      })}`,
    );

    // Commit loading config
    let baseRefKind = "tag";
    let baseRef = core.getInput("baseTag", { required: false });
    if (!baseRef) {
      core.info(
        `Looking for released version with tag matching '${tagPrefix}x.x.x' and name matching '${versionPrefix}x.x.x'`,
      );
      const potentialRef = await retrieveLastReleasedVersion(
        token,
        tagPrefix,
        versionPrefix,
      );
      if (potentialRef) {
        baseRef = potentialRef;
      }
    }
    if (!baseRef) {
      core.info(
        "No released version found, defaulting to the latest commit in the branch",
      );
      baseRefKind = "branch";
      baseRef = github.context.ref.split("/").pop() as string;
    }
    core.info(`Using ${baseRefKind} ${baseRef} as the base for comparison.`);
    core.setOutput("base_tag", baseRef);
    const taskBaseUrl = core.getInput("taskBaseUrl", { required: false });
    const taskPrefix = core.getInput("taskPrefix", { required: false });
    core.debug(
      `Commit configuration: ${JSON.stringify({
        baseTag: baseRef,
        taskBaseUrl,
        taskPrefix,
      })}`,
    );

    // Release config
    const pushTag = core.getInput("pushTag", { required: false }) === "true";
    const templatePath = core.getInput("templatePath", { required: false });
    const draft =
      core.getInput("draft", { required: false }) === "true" || false;
    const prerelease =
      core.getInput("prerelease", { required: false }) === "true" || false;
    core.debug(
      `Release configuration: ${JSON.stringify({
        pushTag,
        templatePath,
        draft,
        prerelease,
      })}`,
    );

    core.debug(`Parse commits from ${baseRef} to current sha`);
    const diffInfo = await commitParser(
      token,
      baseRef,
      taskPrefix,
      taskBaseUrl,
      app,
    );
    const { changes, contributors, tasks, pullRequests } = diffInfo;

    let { nextVersionType } = diffInfo;

    // Force next version as release candidate if prerelease draft is created
    if (prerelease) {
      core.debug("Pre release detected");
      nextVersionType = VersionType.prerelease;
    }

    core.info(`Next version is ${nextVersionType}.`);

    const releaseTag =
      core.getInput("releaseTag", { required: false }) ||
      (await bumpVersion(token, tagPrefix, versionPrefix, nextVersionType));
    if (pushTag) {
      core.debug("Automatic push of git tag triggered");
      await createGitTag(token, releaseTag);
    }

    // Won't replace it if release tag is given manually
    const releaseVersion = releaseTag.replace(tagPrefix, "");
    const releaseTitleTemplate = core.getInput("releaseTitleTemplate", {
      required: false,
    });
    const releaseName =
      core.getInput("releaseName", { required: false }) ||
      releaseTitleTemplate
        .replace(/\$TAG/g, releaseTag)
        .replace(/\$APP/g, app)
        .replace(/\$VERSION/g, releaseVersion);

    // Check for existing release if not a draft
    if (!draft) {
      try {
        const octokit = github.getOctokit(token);
        const existingRelease = await octokit.rest.repos.getReleaseByTag({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          tag: releaseTag,
        });

        if (existingRelease.data) {
          core.info(
            `Release for tag "${releaseTag}" already exists. Skipping creation.`,
          );
          core.setOutput("release_id", existingRelease.data.id.toString());
          core.setOutput("html_url", existingRelease.data.html_url);
          core.setOutput("upload_url", existingRelease.data.upload_url);
          return;
        }
      } catch (error) {
        core.debug(`No existing release found for tag "${releaseTag}"`);
      }
    }

    core.debug(`Generate release body from template ${templatePath}`);
    const body = await renderReleaseBody(
      token,
      templatePath,
      app,
      releaseVersion,
      changes,
      tasks,
      pullRequests,
      contributors,
    );
    core.debug(
      `Create Github release for ${releaseTag} tag with ${releaseName} title`,
    );
    await createGithubRelease(
      token,
      releaseTag,
      releaseName,
      body,
      draft,
      prerelease,
      tagPrefix,
    );
  } catch (error) {
    core.debug(JSON.stringify(error));
    core.setFailed((error as Error).message);
  }
}
