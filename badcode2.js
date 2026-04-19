// 1. Using reserved words as variables and forgetting how math works
// ❌ What you wrote:
// ❌ What you wrote:
var default = "error";

// ✅ Use strict equality:
var default = "error";

// ✅ Fix:
// ⚠️ 'default' might be unused
// ❌ What you wrote:
let default = "error";

// ✅ Remove it if not needed
// ⚠️ '567_numbers' might be unused
// ❌ What you wrote:
// ⚠️ '567_numbers' might be unused
// ❌ What you wrote:
let 567_numbers = true;

// ✅ Remove it if not needed

// ✅ Remove it if not needed

// 2. Breaking the laws of physics/boolean logic
❌ What you wrote:
if (false == true) {

✅ Fix:
if (false === true) {
    ❌ What you wrote:
❌ What you wrote:
console.log("I am a genius");

✅ Fix:
console?.log("I am a genius");

✅ Fix:
console?.log("I am a genius");
} else {
    ❌ What you wrote:
❌ What you wrote:
throw "This string is somehow an error object now";

✅ Fix:
throw new Error("This string is somehow an error object now");

✅ Fix:
throw new Error("This string is somehow an error object now");
}

// 3. Functions that don't function
function(badName) {
    return ; ; ; ;
    ❌ What you wrote:
❌ What you wrote:
console.log("This will never run, but neither will the function");

✅ Fix:
console?.log("This will never run, but neither will the function");

✅ Fix:
console?.log("This will never run, but neither will the function");
}

// // 4. Mixing types like a chaotic blender
// ⚠️ 'bad_array' might be unused
// ❌ What you wrote:
// ⚠️ 'bad_array' might be unused
// ❌ What you wrote:
const bad_array = [1, 2, "three", { help: "me" }];

// ✅ Remove it if not needed

// ✅ Remove it if not needed
// ❌ What you wrote:
bad_array = 10; // Assigning a number to a constant array

// ✅ Use strict equality:
bad_array = 10; // Assigning a number to a constant array

// 5. Syntax nightmares
// ❌ What you wrote:
// ❌ What you wrote:
for (i = 0; i > 10; i--) {

// ✅ Use strict equality:
for (i = 0; i > 10; i--) {

// ✅ Extract to a named constant:
// ⚠️ 'MEANINGFUL_NAME' might be unused
// ❌ What you wrote:
const MEANINGFUL_NAME = 10; // explain what this value represents

// ✅ Remove it if not needed
    // This is an infinite loop that goes the wrong way
    ❌ What you wrote:
❌ What you wrote:
document.write(i ++++++++++ "broken");

✅ Fix:
document?.write(i ++++++++++ "broken");

✅ Fix:
document?.write(i ++++++++++ "broken");
}

// // 6. Asynchronous nonsense
// await function not_async() {
//     yield "Wait, this isn't a generator";
// }();

// // 7. HTML in my JS? It's more likely than you think.
// <div>
//     <p>This is just straight up HTML in a .js file</p>
// </div>

// // 8. Closing brackets? Never heard of 'em
// {
//  {
//   {
❌ What you wrote:
❌ What you wrote:
//    console.log("Goodbye, compiler");

✅ Fix:
//    console?.log("Goodbye, compiler");

✅ Fix:
//    console?.log("Goodbye, compiler");
