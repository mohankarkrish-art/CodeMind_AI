import json
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from .rag import upload_doc, analyze as run_analysis, DOCS, RAGError

def home(request): return render(request, "index.html")
@require_GET
def health(request): return JsonResponse({"status":"ok"})
@require_GET
def documents(request): return JsonResponse({"documents":DOCS})
@csrf_exempt
@require_POST
def upload(request):
    f = request.FILES.get("file")
    if not f: return JsonResponse({"error":"Choose a PDF or TXT file."}, status=400)
    if f.size > 8*1024*1024: return JsonResponse({"error":"Maximum upload size is 8 MB."},status=413)
    ext = f.name.rsplit(".",1)[-1].lower() if "." in f.name else ""
    if ext not in ("pdf","txt"): return JsonResponse({"error":"Only PDF and TXT files are supported."},status=400)
    try: return JsonResponse({"message":"Indexed successfully","document":upload_doc(f.name,f.read(),ext)["document"]})
    except RAGError as e: return JsonResponse({"error":str(e)},status=400)
    except Exception as e: return JsonResponse({"error":"Processing failed: "+str(e)},status=500)
@csrf_exempt
@require_POST
def analyze(request):
    try: data=json.loads(request.body.decode("utf-8"))
    except Exception: return JsonResponse({"error":"Invalid JSON body."},status=400)
    code=(data.get("code") or "").strip()
    if not code: return JsonResponse({"error":"Paste code before analyzing."},status=400)
    if len(code)>20000: return JsonResponse({"error":"Code exceeds 20,000 characters."},status=413)
    try: return JsonResponse(run_analysis(code,(data.get("language") or "Python")[:40],(data.get("problem") or "")[:3000]))
    except RAGError as e: return JsonResponse({"error":str(e)},status=400)
    except Exception as e: return JsonResponse({"error":"Analysis failed: "+str(e)},status=500)
