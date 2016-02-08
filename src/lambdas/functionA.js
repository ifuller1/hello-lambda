export function functionA(eventObject, context)
{
  console.dir(eventObject);
  context.succeed("Function A");
}