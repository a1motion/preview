import { promises as fs } from "fs";
import path from "path";
import mime from "mime";
import aws from "aws-sdk";

aws.config.credentials = new aws.SharedIniFileCredentials({
  profile: "a1motion",
});

const s3 = new aws.S3();

function flattenDeep(arr: any): any {
  return arr.reduce(
    (acc: any, e: any) =>
      Array.isArray(e) ? acc.concat(flattenDeep(e)) : acc.concat(e),
    []
  );
}

export async function getFilesInDir(dir: any): Promise<any> {
  let files = await fs.readdir(dir);
  files = files.map((file) => path.join(dir, file));
  const stats = await Promise.all(files.map((file) => fs.lstat(file)));
  const data = await Promise.all(
    files.map((file, i) => {
      if (stats[i].isDirectory()) {
        return getFilesInDir(file);
      }

      return file;
    })
  );
  return flattenDeep(data);
}

function contentType(src: string, ext?: string) {
  return (mime.getType(ext || src) || "").replace("-", "");
}

const deploy = async () => {
  let files = await getFilesInDir("./build");
  await Promise.all(
    files.map(async (file: any) => {
      let Key = path.relative("./build", file);
      const Body = await fs.readFile(file);
      if (Key.endsWith(".map")) {
        return null;
      }

      const CacheControl =
        Key === "index.html"
          ? "no-cache, no-store, must-revalidate"
          : "public, max-age=31536000";
      const Bucket = "public.a1motion.com";
      Key = Key.replace(/\\/g, "/");
      Key = `preview/${Key}`;
      return s3
        .putObject({
          Body,
          CacheControl,
          Key,
          Bucket,
          ContentLength: Body.length,
          ContentType: contentType(file),
        })
        .promise();
    })
  );
  files = await getFilesInDir("./static");
  await Promise.all(
    files.map(async (file: any) => {
      let Key = path.relative("./static", file);
      const Body = await fs.readFile(file);
      const CacheControl = "public, max-age=31536000";
      const Bucket = "public.a1motion.com";
      Key = Key.replace(/\\/g, "/");
      Key = `preview/${Key}`;
      return s3
        .putObject({
          Body,
          CacheControl,
          Key,
          Bucket,
          ContentLength: Body.length,
          ContentType: contentType(file),
        })
        .promise();
    })
  );
};

deploy();
