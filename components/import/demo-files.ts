// january 2021 for both meters, the esl readings of january and february and two files
// of a sensor that is ignored, copied from the sample data. the list is in public/demo/files.json
const DEMO_DIR = "/demo";

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response;
}

export async function loadDemoFiles(): Promise<File[]> {
  const names: string[] = await (
    await fetchOk(`${DEMO_DIR}/files.json`)
  ).json();
  return Promise.all(
    names.map(async (name) => {
      const blob = await (await fetchOk(`${DEMO_DIR}/${name}`)).blob();
      return new File([blob], name, { type: "text/xml" });
    }),
  );
}
