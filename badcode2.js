// 1. Using reserved words as variables and forgetting how math works
var default = "error";
let 567_numbers = true;

// 2. Breaking the laws of physics/boolean logic
if (false == true) {
    console.log("I am a genius");
} else {
    throw "This string is somehow an error object now";
}

// 3. Functions that don't function
function(badName) {
    return ; ; ; ;
    console.log("This will never run, but neither will the function");
}

// // 4. Mixing types like a chaotic blender
const bad_array = [1, 2, "three", { help: "me" }];
bad_array = 10; // Assigning a number to a constant array

// 5. Syntax nightmares
for (i = 0; i > 10; i--) {
    // This is an infinite loop that goes the wrong way
    document.write(i ++++++++++ "broken");
}

// 6. Asynchronous nonsense
await function not_async() {
    yield "Wait, this isn't a generator";
}();

// 7. HTML in my JS? It's more likely than you think.
<div>
    <p>This is just straight up HTML in a .js file</p>
</div>

// 8. Closing brackets? Never heard of 'em
{
 {
  {
   console.log("Goodbye, compiler");
