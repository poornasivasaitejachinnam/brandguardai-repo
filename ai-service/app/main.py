from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.analyze import router as analyze_router

app = FastAPI(title='BrandGuard AI Service')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(analyze_router)


@app.get('/')
async def root():
    return {'service': 'BrandGuard AI Service', 'status': 'online'}


if __name__ == '__main__':
    import os
    import uvicorn

    host = os.getenv('AI_SERVICE_HOST', '0.0.0.0')
    port = int(os.getenv('AI_SERVICE_PORT', 8000))
    uvicorn.run('app.main:app', host=host, port=port, reload=True)

