export function functionB(eventObject, context)
{
  console.dir(eventObject);
  context.succeed("Function B");
}